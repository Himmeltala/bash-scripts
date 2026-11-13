"""nodex 网页模式的转发进程：起页面、接接口、起进程。

只用 python3.7 起的标准库，不需要装东西。三件事：

- 页面与接口：读 bash 写好的状态文件，拼成 JSON 交给页面。
- 起进程：页面点启动时，用 subprocess 起一条 pnpm/npm/yarn，落在新会话里；
  会话号就是进程组号，停的时候整组 TERM，超时再 KILL。
- 干活的还是 bash：扫描、拼参数、写状态都在 nodex 那边，
  ``nodex --engine`` 常驻，通过管道把请求递过去。

状态文件的格式见 lib/nodex/server.sh，下面的列号必须与它一致。
"""

import argparse
import codecs
import json
import os
import queue
import re
import shutil
import signal
import socket
import subprocess
import sys
import threading
import time
import webbrowser
from pathlib import Path
from urllib.parse import parse_qs, quote, urlparse

# 共用骨架在仓库根的 lib/py-shared 下，源码与安装后的相对层级一致。
sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "lib" / "py-shared"))
from browse import inside, list_dirs
from metrics import Metrics
from runner import EngineClient, Sessions, StateRows, sh_shell_argv
from sse import MetricsStream, SSEMixin, StateStream, tail
from stores import FS, AliasStore, Row, attach_alias_rel
from web import ApiError, STREAMED, WebHandler, WebServer, guess_host, is_any, log, zip_dir


def one_line(value):
    """命令与名称都压成一行：引擎按行收请求，换行会把协议打断。"""
    return " ".join(str(value or "").split())


# 状态行的列，与 lib/nodex/server.sh 里的 web_col 一致，0 起。
WS_KIND, SVC_KIND, SCRIPT_KIND, RUN_KIND = "ws", "svc", "script", "run"
LIVE = ("starting", "ready")
# 运行号是「服务 id.纳秒」：去掉末尾那一段就是服务 id。
RUN_PREFIX_RE = re.compile(r"\.[0-9]+$")
# 行内列号（0 起）。svc 行与 run 行的公共段：id 1、工作区 2、类型 3。
CO_ID, CO_WS, CO_TYPE = 1, 2, 3
# svc 行：执行目录第 4 列、相对路径第 5 列、参数第 6 列、展示命令第 8 列、包管理器第 9 列。
SVC_DIR, SVC_REL, SVC_ARGS, SVC_CMD, SVC_PM = 4, 5, 6, 8, 9
# run 行（17 段，0 起）：脚本目录的相对路径第 6 列、展示路径第 7 列、会话号 11、端口 12、状态 13。
RUN_REL = 6
RUN_DISPLAY = 7
RUN_PID, RUN_PORT, RUN_STATUS = 11, 12, 13
# run 行第 1 段是类型 run，第 2 段起依次是这 16 个字段，顺序与 lib/nodex/server.sh 的 web_run_line 一致。
RUN_FIELDS = ("id", "ws", "type", "tag", "path", "pl", "display", "module", "args",
              "cmd", "pid", "port", "status", "started", "code", "err")


# 一次引擎调用的上限：扫描大工程几秒，留足余量。
ENGINE_TIMEOUT = 120
# 状态文件坏了最多打这么多行日志，免得刷屏。
COERCIONS = 3


WS_WIDTH, SVC_WIDTH, SCRIPT_WIDTH, RUN_WIDTH = 4, 10, 4, 17
WIDTHS = {WS_KIND: WS_WIDTH, SVC_KIND: SVC_WIDTH, SCRIPT_KIND: SCRIPT_WIDTH, RUN_KIND: RUN_WIDTH}


def parse_rows(text):
    rows = []
    for line in text.splitlines():
        if not line:
            continue
        parts = line.split(FS)
        # 列数必须正好对上：多一段少一段都是写坏了，用它会整行错位，不如丢掉。
        if len(parts) == WIDTHS.get(parts[0]):
            rows.append(parts)
    return rows


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
    seen = set()
    for root in (roots if roots is not None else NODE_ROOTS):
        try:
            entries = sorted(Path(root).iterdir(), key=lambda p: p.name)
        except OSError:
            continue
        for entry in entries:
            if entry.name.startswith(".") or entry.is_symlink():
                continue
            try:
                if not entry.is_dir():
                    continue
            except OSError:
                continue
            home = entry / "installation" if (entry / "installation").is_dir() else entry
            try:
                real = home.resolve()
            except OSError:
                continue
            if real in seen or not is_node_home(real):
                continue
            seen.add(real)
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
    return node if node and is_node_home(node) else ""


def build_env(node, base=None):
    """node 非空时把它的 bin 放到 PATH 最前；空则原样继承。"""
    if not node:
        return None
    env = dict(os.environ if base is None else base)
    bindir = os.path.join(node, "bin")
    parts = [p for p in env.get("PATH", "").split(os.pathsep) if p and p != bindir]
    env["PATH"] = os.pathsep.join([bindir] + parts)
    return env


class NodeStore:
    """工作区到 Node 安装目录的映射，存在状态文件旁边，只有网页进程写它。"""

    def __init__(self, path):
        self.path = Path(path)
        self._lock = threading.Lock()

    def _load(self):
        out = {}
        try:
            text = self.path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            return out
        for line in text.splitlines():
            if not line:
                continue
            ws, sep, node = line.partition(FS)
            if sep and ws:
                out[ws] = node
        return out

    def _save(self, data):
        tmp = self.path.with_name(self.path.name + ".tmp")
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            text = "".join(ws + FS + node + "\n" for ws, node in data.items() if ws)
            tmp.write_text(text, encoding="utf-8")
            os.replace(tmp, self.path)
        except OSError as exc:
            log("写 Node 设置失败 %s：%s" % (self.path, exc))

    def get(self, ws):
        with self._lock:
            return self._load().get(ws, "")

    def set(self, ws, node):
        with self._lock:
            data = self._load()
            if node:
                data[ws] = node
            else:
                data.pop(ws, None)
            self._save(data)

    def remove(self, ws):
        with self._lock:
            data = self._load()
            data.pop(ws, None)
            self._save(data)


def attach_nodes(snapshot, store):
    """把每个工作区选中的 Node 与失效标记拼进状态回话。"""
    for ws in snapshot.get("workspaces", []):
        node = store.get(ws["id"])
        ws["node"] = node
        ws["node_missing"] = bool(node) and not is_node_home(node)
    return snapshot


class CustomStore:
    """自定义命令的登记表，每行：工作区|类型|脚本目录|名称|完整命令。这里只用来标记哪些服务是自定义的。"""

    def __init__(self, path):
        self.path = Path(path)

    def ids(self):
        out = set()
        try:
            text = self.path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            return out
        for line in text.splitlines():
            parts = line.split(FS)
            if len(parts) >= 4 and parts[0] and parts[1] and parts[3]:
                out.add("%s.%s.%s" % (parts[0], parts[1], parts[3]))
        return out


def state_payload(state, nodes, aliases, custom):
    """页面要的整份状态：工作区、脚本、服务、运行记录，加上别名与 Node 选择。"""
    return attach_alias_rel(attach_nodes(state.snapshot(custom), nodes), aliases)


# 状态文件


class State(StateRows):
    """状态文件只读：写全在 bash 那边、整体替换；页面轮询很密，先比 mtime，没变就不重新解析。"""

    def parse_rows(self, text):
        return parse_rows(text)

    def snapshot(self, custom=None):
        custom_ids = custom.ids() if custom is not None else set()
        scripts = {}
        runs = {}
        workspaces = []
        by_id = {}
        for r in self.rows():
            if r[0] == WS_KIND:
                item = {"id": r[1], "root": r[2], "added": r[3], "scripts": [], "services": []}
                by_id[r[1]] = item
                workspaces.append(item)
            elif r[0] == SCRIPT_KIND:
                scripts.setdefault(r[2], []).append({"rel": r[1], "name": r[3]})
            elif r[0] == RUN_KIND:
                # 一个服务跑过多次会留下多条记录，留下最新的一条。
                runs[RUN_PREFIX_RE.sub("", r[1])] = Row(r)

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


def run_info(r):
    # Row 的 self.f 是整行，第 1 段是类型；列表切片不走 __getitem__，用 .f 取。
    d = dict(zip(RUN_FIELDS, r.f[1:]))
    d.setdefault("pl", "")
    return d


# 引擎




class Engine(EngineClient):
    """nodex 的执行端：``nodex --engine`` 守着请求流，断了再拉起来；扫描工程要几秒，不复用就每次重载。"""

    label = "nodex"

    def __init__(self, nodex, state, sessions, logs, nodes=None):
        super().__init__(nodex, state, sessions, logs)
        self.nodes = nodes

    def engine_env(self):
        return {"NODEX_WEB_ENGINE": "1"}

    # 页面的动作

    def add_workspace(self, root):
        self.call("add", root)

    def remove_workspace(self, ws):
        for run in self.state.runs(ws):
            if run[RUN_STATUS] in LIVE:
                self.sessions.kill_group(run[RUN_PID])
        # 正在跑的先停，再让 bash 删登记。
        self.call("remove", ws)

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

        first = self.call("reserve", svc, extra)
        parts = first.split(FS)
        # 回话是「运行号|目录|参数|预排行|代次」：预排行自己带着分隔符，段数不定。
        # 前四段取头部，代次取最后一段，中间那串就是预排行。
        if len(parts) < 5:
            raise ApiError(500, "nodex 没有给出启动参数：%r" % first)
        if parts[0] == "":
            parts = parts[1:]
        runid, path, run_args = parts[0], parts[1], parts[2]
        gen = parts[-1]

        log_path = self.logs / runid.split(".", 1)[0] / (runid + ".log")
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

    def stop(self, runid):
        run = self.state.find(RUN_KIND, runid)
        if run is None or run[RUN_STATUS] not in LIVE:
            raise ApiError(409, "这个服务没有在跑")
        self.sessions.kill_group(run[RUN_PID])
        self.call("stop", runid)


# 页面与接口


# 压缩


# 与 zipx 的默认排除一致：树里列出来但置灰，勾不上。
ZIP_EXCLUDES = (".git", ".svn", ".idea", "node_modules", "target")
# 一层最多回这么多个条目：几千个文件的目录摊开会把页面卡住。
MAX_ENTRIES = 2000
# 压缩任务的运行号，日志目录名也跟着它。
ZIP_RUN_RE = re.compile(r"^zip\.[0-9]+$")


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


def list_entries(state, ws, rel):
    """列工作区里某一层的内容：目录与文件分开，排除项原样带上，页面自己置灰。"""
    root = ws_root(state, ws)
    base = resolve_in_root(root, rel or ".", "目录")
    if not base.is_dir():
        raise ApiError(400, "不是目录：%s" % rel)

    dirs = []
    files = []
    truncated = False
    try:
        with os.scandir(base) as it:
            for entry in it:
                if len(dirs) + len(files) >= MAX_ENTRIES:
                    truncated = True
                    break
                try:
                    is_dir = entry.is_dir(follow_symlinks=True)
                    size = 0 if is_dir else entry.stat(follow_symlinks=False).st_size
                except OSError:
                    # 断掉的链接读不了属性，照样列出来，交给打包那步报错。
                    is_dir, size = False, 0
                item = {
                    "name": entry.name,
                    "rel": Path(entry.path).relative_to(root).as_posix(),
                    "dir": is_dir,
                    "size": size,
                    "excluded": entry.name in ZIP_EXCLUDES,
                }
                (dirs if is_dir else files).append(item)
    except PermissionError:
        raise ApiError(403, "没有权限读取：%s" % base)
    except OSError as exc:
        raise ApiError(400, "读取目录失败：%s" % exc)

    def order(item):
        return item["name"].casefold()

    dirs.sort(key=order)
    files.sort(key=order)
    return {
        "root": str(root),
        "rel": rel or ".",
        "entries": dirs + files,
        "excluded": list(ZIP_EXCLUDES),
        "truncated": truncated,
    }


def zip_name(root, name):
    """包名默认取工作区目录名；没写后缀就补 .zip，落点必须在工作区里。"""
    text = str(name or "").strip() or "%s.zip" % root.name
    if not text.lower().endswith(".zip"):
        text += ".zip"
    target = resolve_in_root(root, text, "包名")
    if target == root or target.is_dir():
        raise ApiError(400, "包名要落到具体文件：%s" % text)
    if not target.parent.is_dir():
        raise ApiError(400, "保存目录不存在：%s" % target.parent)
    return text, target


def zip_entries(root, entries):
    """校验勾选的条目，返回 zip 命令要的相对路径：被祖先目录盖住的去掉，重复的去掉。"""
    if not isinstance(entries, list) or not entries:
        raise ApiError(400, "一个条目都没选")
    rels = []
    for rel in entries:
        text = str(rel or "").strip()
        if not text:
            continue
        if "\n" in text:
            raise ApiError(400, "名字里有换行，处理不了")
        target = resolve_in_root(root, text, "条目")
        if not target.exists():
            raise ApiError(404, "条目不存在：%s" % text)
        hit = target.relative_to(root).as_posix() if target != root else "."
        if hit not in rels:
            rels.append(hit)
    if not rels:
        raise ApiError(400, "一个条目都没选")
    # 选了 src 又选 src/a.js 时只传 src，zip 本来就会带上下面的内容。
    keep = []
    for rel in rels:
        if rel == ".":
            keep = ["."]
            break
        covered = any(rel == other or rel.startswith(other + "/") for other in rels if other != rel)
        if not covered:
            keep.append(rel)
    return keep


def find_zipx(nodex_path):
    """优先用与 nodex 同目录的 zipx，没有再走 PATH。"""
    if nodex_path:
        sibling = Path(nodex_path).parent / "zipx"
        if sibling.is_file() and os.access(str(sibling), os.X_OK):
            return str(sibling)
    return shutil.which("zipx") or ""


METRICS = Metrics()


class Handler(SSEMixin, WebHandler):
    server_version = "nodex-web"

    static = None
    state = None
    sessions = None
    engine = None
    nodes = None
    aliases = None
    custom = None
    logs = None
    state_stream = None
    metrics_stream = None
    api_prefix = "/__nodex/api"
    # 压缩任务的包名与落点，按运行号记着，页面问状态时回给它。
    zip_jobs = {}
    zip_lock = threading.Lock()

    # 路由

    def _dispatch(self, method, route, query, body):
        if route == "log/stream":
            self._stream_log((query.get("run") or [""])[0])
            return STREAMED
        if route == "state/stream":
            self._sse([(self.state_stream, "state"), (self.metrics_stream, "metrics")])
            return STREAMED
        if route == "state":
            # 没用推送的客户端照样能拿到收拾过的状态。
            try:
                self.engine.call("tick")
            except ApiError as exc:
                log("tick 失败：%s" % exc.message)
            return state_payload(self.state, self.nodes, self.aliases, self.custom)
        if route == "log":
            return self._log(query)
        if route == "dirs":
            return list_dirs((query.get("path") or [""])[0])
        if route == "nodes":
            return {"nodes": discover_nodes(), "current": current_node_version()}
        if route == "entries":
            return list_entries(
                self.state,
                (query.get("ws") or [""])[0],
                (query.get("rel") or [""])[0],
            )
        if route == "zip" and method != "POST":
            return self._zip_status((query.get("run") or [""])[0])
        if route == "download":
            return self._download(query, head=(method == "HEAD"))
        if route == "entry":
            return self._entry_download(query, head=(method == "HEAD"))
        if route == "metrics/stream":
            self._sse([(self.metrics_stream, "metrics")])
            return STREAMED
        if route == "metrics":
            return METRICS.snapshot()
        if method != "POST":
            raise ApiError(405, "这个接口只接受 POST")
        engine = self.engine
        if route == "workspaces":
            root = str(body.get("root", "")).strip()
            if not root:
                raise ApiError(400, "没给目录")
            engine.add_workspace(root)
            return {"ok": True}
        if route == "rescan":
            engine.call("scan", str(body.get("ws", "")))
            return {"ok": True}
        if route == "forget":
            ws = str(body.get("ws", ""))
            engine.remove_workspace(ws)
            self.nodes.remove(ws)
            if self.aliases is not None:
                self.aliases.set(ws, "")
            return {"ok": True}
        if route == "alias":
            ws = str(body.get("ws", "")).strip()
            if not ws or self.state.find(WS_KIND, ws) is None:
                raise ApiError(404, "没有这个工作区：%s" % ws)
            self.aliases.set(ws, str(body.get("alias", "")))
            return {"ok": True}
        if route == "node":
            ws = str(body.get("ws", "")).strip()
            node = str(body.get("node", "") or "").strip()
            if not ws or self.state.find(WS_KIND, ws) is None:
                raise ApiError(404, "没有这个工作区：%s" % ws)
            if node:
                node = os.path.abspath(os.path.expanduser(node))
                if not is_node_home(node):
                    raise ApiError(400, "这个目录不是 Node：缺 bin/node")
            self.nodes.set(ws, node)
            return {"ok": True}
        if route == "start":
            return engine.start(body)
        if route == "zip":
            return self._zip_start(body)
        if route == "stop":
            engine.stop(str(body.get("run", "")))
            return {"ok": True}
        if route == "update":
            engine.call(
                "update",
                str(body.get("svc", "")),
                one_line(body.get("args", "")),
            )
            return {"ok": True}
        if route == "addcmd":
            engine.call(
                "addcmd",
                str(body.get("ws", "")).strip(),
                str(body.get("type", "")).strip(),
                str(body.get("rel", "") or ".").strip(),
                one_line(body.get("tag", "")),
                one_line(body.get("args", "")),
            )
            return {"ok": True}
        if route == "delcmd":
            engine.call("delcmd", str(body.get("svc", "")).strip())
            return {"ok": True}
        raise ApiError(404, "没有这个接口：%s" % route)


    def _log(self, query):
        runid = (query.get("run") or [""])[0]
        run = self.state.find(RUN_KIND, runid)
        try:
            page = max(0, int((query.get("page") or ["0"])[0] or 0))
        except ValueError:
            page = 0
        path = Path(self.logs) / runid.split(".", 1)[0] / (runid + ".log")
        text, more = tail(path, page)
        info = run_info(run) if run else {}
        return {
            "run": runid,
            "status": info.get("status", ""),
            "code": info.get("code", ""),
            "text": text,
            "page": page,
            "more": more,
        }

    # 压缩

    def _zip_start(self, body):
        """勾好的条目交给 zipx 打成一个包，日志走与启动服务同一套目录。"""
        ws = str(body.get("ws", "")).strip()
        root = ws_root(self.state, ws)
        name, target = zip_name(root, body.get("name", ""))
        rels = zip_entries(root, body.get("entries"))
        exe = find_zipx(self.engine.nodex if self.engine else "")
        if not exe:
            raise ApiError(500, "找不到 zipx，确认它和 nodex 装在同一个 bin 目录")
        if target.exists():
            # 同名包直接覆盖。zip 的 -r 对已有包是补条目、旧条目会留着，
            # 所以先把旧包删掉，再让 zipx 重新打一份；--overwrite 照样带上。
            if not target.is_file():
                raise ApiError(400, "包名要落到具体文件：%s" % name)
            try:
                target.unlink()
            except OSError as exc:
                raise ApiError(403, "删不掉旧的包：%s" % exc)
        argv = [exe, "pack", "-o", str(target)] + rels + ["--overwrite"]
        runid = "zip.%d" % time.time_ns()
        log_path = Path(self.logs) / "zip" / (runid + ".log")
        node = effective_node(self.nodes.get(ws)) if self.nodes else ""
        try:
            self.sessions.spawn(str(root), argv, log_path, env=build_env(node))
        except OSError as exc:
            raise ApiError(500, "起 zipx 失败：%s" % exc)
        with self.zip_lock:
            self.zip_jobs[runid] = {"name": name, "path": str(target)}
        return {"run": runid, "name": name, "path": str(target), "entries": len(rels)}

    def _zip_status(self, runid):
        """这次压缩还在不在跑：进程退出后 zipx 的退出码落在日志旁边的 .code 文件里。"""
        if not ZIP_RUN_RE.match(runid or ""):
            raise ApiError(400, "运行号不对")
        log_path = Path(self.logs) / "zip" / (runid + ".log")
        try:
            code = int(Path(str(log_path) + ".code").read_text(encoding="utf-8").strip())
        except (OSError, ValueError):
            code = None
        with self.zip_lock:
            job = dict(self.zip_jobs.get(runid, {}))
        size = 0
        if job.get("path"):
            try:
                size = os.path.getsize(job["path"])
            except OSError:
                size = 0
        return {
            "run": runid,
            "running": code is None,
            "code": code,
            "name": job.get("name", ""),
            "path": job.get("path", ""),
            "size": size,
        }

    def _entry_download(self, query, head=False):
        ws = (query.get("ws") or [""])[0]
        rel = (query.get("path") or [""])[0]
        root = ws_root(self.state, ws)
        target = resolve_in_root(root, rel or ".", "路径")
        if target.is_dir():
            path, _ = zip_dir(target, ZIP_EXCLUDES)
            name = (target.name or "download") + ".zip"
            try:
                self._send_download(path, name, head=head)
            finally:
                os.unlink(path)
            return STREAMED
        if not target.is_file():
            raise ApiError(404, "没有这个文件：%s" % (rel or "根目录"))
        self._send_download(target, target.name, head=head)
        return STREAMED

    def _download(self, query, head=False):
        """把打好的包吐给浏览器：认单范围 Range，断了下一次能从断点接着来。"""
        ws = (query.get("ws") or [""])[0]
        name = (query.get("name") or [""])[0]
        root = ws_root(self.state, ws)
        target = resolve_in_root(root, name, "包名")
        if not target.is_file():
            raise ApiError(404, "这个包不在了：%s" % name)
        try:
            stat = target.stat()
            size = stat.st_size
            handle = open(target, "rb")
        except OSError as exc:
            raise ApiError(403, "读不了这个包：%s" % exc)
        # 大小加修改时间当版本号：包被重打过，续传就得从头来，不能把两版拼一起。
        etag = '"%d-%d"' % (size, stat.st_mtime_ns)
        last_modified = self.date_time_string(stat.st_mtime)

        start, end, status = 0, max(0, size - 1), 200
        spec = self.headers.get("Range", "").strip()
        if not self._if_range_matches(etag, last_modified):
            spec = ""
        if spec.startswith("bytes="):
            first, _, last = spec[6:].split(",")[0].strip().partition("-")
            try:
                if first:
                    start = int(first)
                    end = int(last) if last else size - 1
                elif last:
                    # bytes=-N：最后 N 个字节。
                    start = max(0, size - int(last))
                    end = size - 1
                end = min(end, size - 1)
            except ValueError:
                start, end = 0, max(0, size - 1)
            if start >= size or start > end:
                # 够不着这个范围：按 RFC 回 416，并告诉对方总共多大。
                handle.close()
                self.send_response(416)
                self.send_header("Content-Range", "bytes */%d" % size)
                self.send_header("Content-Length", "0")
                self.end_headers()
                return STREAMED
            status = 206

        length = 0 if size == 0 else end - start + 1
        self.send_response(status)
        self.send_header("Content-Type", "application/zip")
        self.send_header("Content-Length", str(length))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("ETag", etag)
        self.send_header("Last-Modified", last_modified)
        if status == 206:
            self.send_header("Content-Range", "bytes %d-%d/%d" % (start, end, size))
        self.send_header("Content-Disposition", "attachment; filename*=UTF-8''%s" % quote(target.name))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        if head:
            handle.close()
            return STREAMED
        try:
            with handle:
                handle.seek(start)
                left = length
                while left > 0:
                    chunk = handle.read(min(65536, left))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    left -= len(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass
        return STREAMED

    def _if_range_matches(self, etag, last_modified):
        """If-Range 没带就照常；带了且与当前这份对不上，整份重发。"""
        given = self.headers.get("If-Range", "").strip()
        return not given or given == etag or given == last_modified


def serve(args):
    static = Path(args.static).resolve()
    if not (static / "index.html").is_file():
        log("缺 %s/index.html，前端还没打包" % static)
        return 3

    state = State(args.state)
    sessions = Sessions(fallback=sh_shell_argv)
    nodes = NodeStore(Path(args.state).parent / "node.tsv")
    aliases = AliasStore(Path(args.state).parent / "alias.tsv")
    custom = CustomStore(Path(args.custom)) if args.custom else None
    engine = Engine(os.path.abspath(args.nodex), state, sessions, args.logs, nodes)

    Handler.static = static
    Handler.state = state
    Handler.sessions = sessions
    Handler.engine = engine
    Handler.nodes = nodes
    Handler.aliases = aliases
    Handler.custom = custom
    Handler.logs = str(Path(args.logs).resolve())
    Handler.api_prefix = args.api

    # 状态与指标各一条后台线程，页面开几个都共用这一份。
    watched = [args.state, Path(args.state).parent / "alias.tsv", Path(args.state).parent / "node.tsv"]
    if args.custom:
        watched.append(args.custom)
    Handler.state_stream = StateStream(
        watched,
        build=lambda: state_payload(state, nodes, aliases, custom),
        tick=lambda: engine.call("tick"),
    )
    Handler.metrics_stream = MetricsStream(METRICS)
    Handler.state_stream.start()
    Handler.metrics_stream.start()

    try:
        httpd = WebServer((args.host, args.port), Handler)
    except OSError as exc:
        log("端口 %s 用不了：%s" % (args.port, exc))
        return 1
    httpd.daemon_threads = True
    port = httpd.server_address[1]
    host = guess_host() if is_any(args.host) else args.host
    url = "http://%s:%d/" % (host, port)

    # nodex 守着这一行等它就绪；端口填 0 时这里报的是真正用上的那个。
    print("NODEX_WEB_READY %s:%d" % (host, port), flush=True)
    log("nodex 网页：%s" % url)

    def shutdown(signum, frame):
        log("收到信号 %d，退出" % signum)
        threading.Thread(target=httpd.shutdown, daemon=True).start()

    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT, shutdown)

    if args.open:
        threading.Timer(0.5, webbrowser.open, args=(url,)).start()
    try:
        httpd.serve_forever()
    finally:
        httpd.server_close()
    return 0


def main(argv=None):
    parser = argparse.ArgumentParser(prog="nodex-web", description="nodex 网页模式的转发进程")
    parser.add_argument("--static", required=True, help="打包好的页面目录")
    parser.add_argument("--state", required=True, help="状态文件")
    parser.add_argument("--custom", default="", help="自定义命令登记表")
    parser.add_argument("--logs", required=True, help="日志目录")
    parser.add_argument("--api", default="/__nodex/api", help="接口前缀")
    parser.add_argument("--nodex", required=True, help="nodex 入口")
    parser.add_argument("--host", default="0.0.0.0", help="监听地址，默认所有网卡")
    parser.add_argument("--port", type=int, default=0, help="监听端口，默认 0 由系统挑")
    parser.add_argument("--open", action="store_true", help="起来后打开浏览器")
    return serve(parser.parse_args(argv))


if __name__ == "__main__":
    sys.exit(main())
