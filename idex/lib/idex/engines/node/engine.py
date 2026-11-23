"""Node 引擎的服务层：状态解析、Node 版本发现与执行端客户端。

状态文件由 ``engine.sh`` 写、这里只读；页面、HTTP 与压缩不在这份文件里。
状态文件的列号必须与 ``idex/lib/idex/engines/node/engine.sh`` 一致。
"""

import os
import re
import subprocess
import sys
import time
from pathlib import Path

# 共用骨架在仓库根的 lib/py-shared 下；新位置向上五级才是仓库根。
sys.path.insert(0, str(Path(__file__).resolve().parents[5] / "lib" / "py-shared" / "commons"))
sys.path.insert(0, str(Path(__file__).resolve().parents[5] / "lib" / "py-shared" / "services"))
from browse import inside
from metrics import Metrics
from runner import (
    LIVE,
    RUN_KIND,
    RUN_PREFIX_RE,
    RUN_STATUS,
    Sessions,
    StateRows,
    ToolEngine,
    latest_runs,
    parse_fixed_rows,
    run_info,
    run_log_path,
    sh_shell_argv,
)
from sse import MetricsStream, StateStream, log_page
from stores import (
    FS,
    AliasStore,
    HomeStore,
    LayoutStore,
    LineStore,
    attach_alias_rel,
    attach_home,
    attach_layout,
)
from toolchain import effective_home, iter_home_dirs, prepend_bin
from toolweb import WS_KIND
from web import ApiError, log


# 状态行的列，与 engine.sh 里的 web_col 一致，0 起。
SVC_KIND, SCRIPT_KIND = "svc", "script"
# 行内列号（0 起）。svc 行与 run 行的公共段：id 1、工作区 2、类型 3。
CO_ID, CO_WS, CO_TYPE = 1, 2, 3
# svc 行：执行目录第 4 列、相对路径第 5 列、参数第 6 列、展示命令第 8 列、包管理器第 9 列。
SVC_DIR, SVC_REL, SVC_ARGS, SVC_CMD, SVC_PM = 4, 5, 6, 8, 9
# run 行（17 段，0 起）：展示路径第 7 列。
RUN_DISPLAY = 7

WS_WIDTH, SVC_WIDTH, SCRIPT_WIDTH, RUN_WIDTH = 4, 10, 4, 17
WIDTHS = {WS_KIND: WS_WIDTH, SVC_KIND: SVC_WIDTH, SCRIPT_KIND: SCRIPT_WIDTH, RUN_KIND: RUN_WIDTH}


def parse_rows(text):
    return parse_fixed_rows(text, WIDTHS)


def one_line(value):
    """命令与名称都压成一行：引擎按行收请求，换行会把协议打断。"""
    return " ".join(str(value or "").split())


# 按工作区选 Node

# 自动扫描的四处：nvm、fnm、volta、n。别处的 Node 由页面手填路径。
NODE_ROOTS = (
    Path.home() / ".nvm" / "versions" / "node",
    Path.home() / ".local" / "share" / "fnm" / "node-versions",
    Path.home() / ".volta" / "tools" / "image" / "node",
    Path("/usr/local/n/versions/node"),
)


def is_node_home(path):
    """Node 的目录至少要有 bin/node；npm 有的版本放在上一层，这里不强求。"""
    home = Path(path)
    return (home / "bin" / "node").is_file()


def _version_key(name):
    """按版本号排：v20.11.1 比 v9.11.2 新。"""
    nums = re.findall(r"\d+", name)
    return tuple(int(x) for x in nums[:3])


def discover_nodes(roots=None):
    """扫已装的 Node，符号链接跳过（current 之类的别名只是重复）；fnm 装在 <版本>/installation，nvm、volta、n 直接放 <版本> 下。"""
    out = []
    for entry, real in iter_home_dirs(
        roots if roots is not None else NODE_ROOTS, is_node_home, nested="installation"
    ):
        version = entry.name.lstrip("v")
        out.append({"path": str(real), "version": version, "label": version or real.name})

    out.sort(key=lambda item: _version_key(item["version"]), reverse=True)
    return out


def current_node_version():
    """页面上「跟随当前环境」时显示的那个版本。"""
    try:
        done = subprocess.run(
            ["node", "--version"], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=2
        )
        return done.stdout.decode("utf-8", "replace").strip().lstrip("v")
    except (OSError, subprocess.SubprocessError):
        return ""


def effective_node(node):
    """存着的目录还在才用它；不在了回退到当前环境。"""
    return effective_home(node, is_node_home)


def build_env(node, base=None):
    """node 非空时把它的 bin 放到 PATH 最前；空则原样继承。"""
    return prepend_bin(node, base)


class NodeStore(HomeStore):
    """工作区到 Node 安装目录的映射，存在状态文件旁边，只有引擎进程写它。"""

    def __init__(self, path):
        HomeStore.__init__(self, path, "Node")


def attach_nodes(snapshot, store):
    """把每个工作区选中的 Node 与失效标记拼进状态回话。"""
    return attach_home(snapshot, store, "node", is_node_home)


class CustomStore(LineStore):
    """自定义命令的登记表，每行：工作区|类型|脚本目录|名称|完整命令。这里只用来标记哪些服务是自定义的。"""

    def __init__(self, path):
        LineStore.__init__(self, path, allow_empty=True)

    def ids(self):
        out = set()
        for ws, rest in self.all().items():
            parts = rest.split(FS)
            if len(parts) >= 3 and ws and parts[0] and parts[2]:
                out.add("%s.%s.%s" % (ws, parts[0], parts[2]))
        return out


def state_payload(state, nodes, aliases, custom, groups):
    """页面要的整份状态：工作区、脚本、服务、运行记录，加上别名、Node 选择与分组。"""
    return attach_layout(attach_alias_rel(attach_nodes(state.snapshot(custom), nodes), aliases), groups)


# 状态文件


class State(StateRows):
    """状态文件只读：写全在 bash 那边、整体替换；轮询很密，先比 mtime，没变就不重新解析。"""

    def parse_rows(self, text):
        return parse_rows(text)

    def snapshot(self, custom=None):
        custom_ids = custom.ids() if custom is not None else set()
        scripts = {}
        workspaces = []
        by_id = {}
        rows = self.rows()
        runs = latest_runs(rows)
        for r in rows:
            if r[0] == WS_KIND:
                item = {"id": r[1], "root": r[2], "added": r[3], "scripts": [], "services": []}
                by_id[r[1]] = item
                workspaces.append(item)
            elif r[0] == SCRIPT_KIND:
                scripts.setdefault(r[2], []).append({"rel": r[1], "name": r[3]})

        for r in self.rows():
            if r[0] != SVC_KIND:
                continue
            ws = by_id.get(r[2])
            if ws is None:
                continue
            run = runs.get(r[1])
            ws["services"].append(
                {
                    "id": r[1],
                    "type": r[3],
                    "path": r[4],
                    "module": r[5],
                    "args": r[6],
                    "display": r[7],
                    "cmd": r[8],
                    "pm": r[9],
                    "tag": r[1].split(".", 2)[-1],
                    "custom": r[1] in custom_ids,
                    "run": run_info(run) if run else None,
                }
            )

        for ws in workspaces:
            items = scripts.get(ws["id"], [])
            items.sort(key=lambda item: (item["rel"] != ".", item["rel"]))
            ws["scripts"] = items
            ws["services"].sort(key=lambda s: (s["display"], s["id"]))
        return {"workspaces": workspaces, "now": int(time.time())}


# 引擎


class Engine(ToolEngine):
    """Node 的执行端：``engine.sh --engine`` 守着请求流，断了再拉起来；扫描工程要几秒，不复用就每次重载。"""

    label = "Node"

    def __init__(self, engine_script, state, sessions, logs, nodes=None):
        super().__init__(engine_script, state, sessions, logs)
        self.nodes = nodes

    # 页面的动作

    def start(self, body):
        svc = str(body.get("svc", "")).strip()
        row = self.state.find(SVC_KIND, svc)
        if row is None:
            raise ApiError(404, "没有这个服务：%s" % svc)
        extra = str(body.get("extra", "") or "").strip()

        # 同一个服务不重复起，同时点两下也只留一条。
        # 同一个包上的启动与打包互不影响：跑着开发服务照样可以打包。
        for run in self.state.runs():
            if run[RUN_STATUS] not in LIVE:
                continue
            if RUN_PREFIX_RE.sub("", run[CO_ID]) == row[CO_ID]:
                raise ApiError(409, "「%s」正在跑，先停掉" % run[RUN_DISPLAY])
            # 同一个工作区里的 install 也要串行：pnpm 的存储与锁文件只有一份。
            if row[CO_TYPE] == "install" and run[CO_TYPE] == "install" and run[CO_WS] == row[CO_WS]:
                raise ApiError(409, "「%s」正在安装，等它跑完" % run[RUN_DISPLAY])

        # 页面上的参数改动要算数：先存进服务行，启动与展示命令都按它来。
        args = (row[SVC_ARGS] + " " + extra).strip() if extra else row[SVC_ARGS]
        if extra:
            self.call("update", svc, args)

        runid, path, run_args, gen, _row_line = self.reserve(svc, extra)

        log_path = run_log_path(self.logs, runid)
        # 记录里的参数就是完整命令，包管理器由用户填在命令里。
        argv = [w for w in run_args.split() if w]
        if not argv:
            raise ApiError(500, "这个服务没有可执行的命令，先在参数里填一条")
        raw_node = self.nodes.get(row[CO_WS]) if self.nodes else ""
        node = effective_node(raw_node)
        if raw_node and not node:
            log("工作区 %s 选的 Node 已不存在，回退到当前环境：%s" % (row[CO_WS], raw_node))
        env = build_env(node)
        try:
            sid = self.sessions.spawn(path, argv, log_path, env=env)
        except OSError as exc:
            raise ApiError(500, "起 %s 失败：%s" % (argv[0], exc))
        self.call("launched", sid, gen)
        return {"run": runid}


# 服务层


class NodeService:
    """Node 引擎在 idex 里的服务层：状态、执行端、会话与状态推送装成一份。

    原来 nodex 网页进程里的装配搬到这里，HTTP 路由只做参数、映射与权限。
    """

    def __init__(self, nodex, home, custom=None):
        self.home = Path(home)
        self.home.mkdir(parents=True, exist_ok=True)
        self.logs = self.home / "logs"
        self.state = State(self.home / "state.tsv")
        self.sessions = Sessions(fallback=sh_shell_argv)
        self.nodes = NodeStore(self.home / "node.tsv")
        self.aliases = AliasStore(self.home / "alias.tsv")
        self.layout = LayoutStore(self.home / "groups.json")
        self.custom = CustomStore(custom) if custom else None
        self.engine = Engine(str(nodex), self.state, self.sessions, self.logs, self.nodes)
        self.metrics = Metrics()
        # 状态与指标各一条后台线程，页面开几个都共用这一份。
        watched = [
            self.home / "state.tsv",
            self.home / "alias.tsv",
            self.home / "node.tsv",
            self.home / "groups.json",
        ]
        if custom:
            watched.append(Path(custom))
        self.state_stream = StateStream(
            watched,
            build=self.state_payload,
            tick=lambda: self.engine.call("tick"),
        )
        self.metrics_stream = MetricsStream(self.metrics)

    # 启停后台

    def start_background(self):
        self.state_stream.start()
        self.metrics_stream.start()

    def close(self):
        """收掉常驻执行端与状态、指标推送线程；已经起的服务进程不归这里管。"""
        try:
            with self.engine.lock:
                proc = self.engine.proc
                self.engine.proc = None
            if proc is not None and proc.poll() is None:
                try:
                    proc.terminate()
                    proc.wait(timeout=5)
                except (OSError, subprocess.TimeoutExpired):
                    try:
                        proc.kill()
                    except OSError:
                        pass
        finally:
            # 起后台失败时执行端可能还没起来，但推送线程已经起了一半，也要收掉。
            for stream in (self.state_stream, self.metrics_stream):
                try:
                    stream.stop()
                except Exception:
                    pass

    # 状态与动作

    def state_payload(self):
        # 与原 nodex 的状态接口一致：取状态前先让引擎收拾一遍在跑的记录。
        try:
            self.engine.call("tick")
        except ApiError as exc:
            log("tick 失败：%s" % exc.message)
        return state_payload(self.state, self.nodes, self.aliases, self.custom, self.layout)

    def start(self, body):
        return self.engine.start(body)

    def stop(self, run):
        self.engine.stop(str(run or ""))

    def update(self, svc, args):
        self.engine.call("update", str(svc or "").strip(), one_line(args))

    def rescan(self, ws):
        self.engine.call("scan", str(ws or "").strip())

    def add_workspace(self, root):
        self.engine.add_workspace(str(root or "").strip())

    def remove_workspace(self, ws):
        # 先清别名与工具链目录，再移出工作区；工作区没了再按 id 删会找不到。
        self.aliases.set(ws, "")
        self.nodes.remove(ws)
        self.engine.remove_workspace(ws)

    def has_workspace(self, ws):
        """引擎状态里是否已经登记了这个工作区。"""
        return self.state.find(WS_KIND, str(ws or "").strip()) is not None

    def set_node(self, ws, node):
        ws = str(ws or "").strip()
        if self.state.find(WS_KIND, ws) is None:
            raise ApiError(404, "没有这个工作区：%s" % ws)
        node = str(node or "").strip()
        if node:
            node = os.path.abspath(os.path.expanduser(node))
            if not is_node_home(node):
                raise ApiError(400, "这个目录不是 Node：缺 bin/node")
        self.nodes.set(ws, node)

    def add_command(self, ws, type, rel=".", tag="", args=""):
        self.engine.call(
            "addcmd",
            str(ws or "").strip(),
            str(type or "").strip(),
            str(rel or ".").strip(),
            one_line(tag),
            one_line(args),
        )

    def remove_command(self, svc):
        self.engine.call("delcmd", str(svc or "").strip())

    def log_page(self, query):
        return log_page(self.state, self.logs, query, RUN_KIND)


def ws_root(state, ws):
    """工作区的根目录，取出来时解析掉符号链接，后面的包含判断都按真实路径比。"""
    row = state.find(WS_KIND, str(ws or "").strip())
    if row is None:
        raise ApiError(404, "没有这个工作区：%s" % ws)
    try:
        return Path(row[2]).resolve()
    except OSError as exc:
        raise ApiError(400, "工作区目录读不了：%s" % exc)


def resolve_in_root(root, rel, what="路径"):
    """把相对路径落到工作区里，跳出工作区的一律拒绝。"""
    text = str(rel or "").strip()
    if not text:
        raise ApiError(400, "没给%s" % what)
    target = Path(os.path.expanduser(text))
    if not target.is_absolute():
        target = root / target
    try:
        target = target.resolve()
    except OSError as exc:
        raise ApiError(400, "解析%s失败：%s" % (what, exc))
    if not inside(target, root):
        raise ApiError(400, "%s要落在工作区里：%s" % (what, rel))
    return target
