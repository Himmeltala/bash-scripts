"""mvnx 网页模式的转发进程：起页面、接接口、起进程。

只用 python3.7 起的标准库，不需要装东西。三件事：

- 页面与接口：读 bash 写好的状态文件，拼成 JSON 交给页面。
- 起进程：页面点启动时，用 subprocess 起一条 mvn，落在新会话里；
  会话号就是进程组号，停的时候整组 TERM，超时再 KILL。
- 干活的还是 bash：扫描、拼参数、写状态都在 mvnx 那边，
  每个请求拉起一次 ``mvnx --engine``，通过管道把请求递过去。

状态文件的格式见 lib/mvnx/server.sh，下面的列号必须与它一致。
"""

import argparse
import os
import sys
import threading
import time
from pathlib import Path

# 共用骨架在仓库根的 lib/py-shared 下，源码与安装后的相对层级一致。
sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "lib" / "py-shared"))
from metrics import Metrics
from runner import (
    LIVE,
    RUN_KIND,
    RUN_STATUS,
    Sessions,
    StateRows,
    ToolEngine,
    latest_runs,
    parse_fixed_rows,
    run_info,
    run_log_path,
)
from runtime import check_static, serve as serve_web, start_streams
# 行缓冲与 SSE 报文测试直接从本模块取，保留这些名字在模块顶层。
from sse import (
    LineBuffer,
    MetricsStream,
    StateStream,
    last_lines,
    sse_data,
    sse_event,
    tail,
)
from stores import FS, AliasStore, HomeStore, Row, attach_alias_rel, attach_home
from toolchain import effective_home, iter_home_dirs, prepend_bin
from toolweb import NOT_HANDLED, WS_KIND, ToolHandler
from web import ApiError, log

# 状态行的列，与 lib/mvnx/server.sh 里的 web_col 一致，0 起。
SVC_KIND, POM_KIND = "svc", "pom"
MODES = ("auto", "compile", "no-compile", "rebuild")
# 行内列号（0 起）。svc 行与 run 行的公共段：id 1、工作区 2、类型 3、标签 4。
CO_ID, CO_WS, CO_TYPE, CO_TAG = 1, 2, 3, 4
# svc 行：-pl 的值第 5 列、mvn 参数第 6 列。
SVC_MODULE, SVC_ARGS = 5, 6
# run 行（17 段，0 起）：展示路径第 7 列、端口 12。
RUN_DISPLAY = 7
RUN_PORT = 12
# run 行第 1 段是类型 run，第 2 段起依次是这 16 个字段，顺序与 lib/mvnx/server.sh 的 web_run_line 一致。


# 一次引擎调用的上限：扫描大工程几秒，留足余量。
ENGINE_TIMEOUT = 120
# 状态文件坏了最多打这么多行日志，免得刷屏。
COERCIONS = 3


WS_WIDTH, SVC_WIDTH, POM_WIDTH, RUN_WIDTH = 4, 9, 4, 17
WIDTHS = {WS_KIND: WS_WIDTH, SVC_KIND: SVC_WIDTH, POM_KIND: POM_WIDTH, RUN_KIND: RUN_WIDTH}


def parse_rows(text):
    return parse_fixed_rows(text, WIDTHS)


# 按工作区选 JDK

# 自动扫描的两处：SDKMAN 装的与发行版软件包装的。别处的 JDK 由页面手填路径。
JDK_ROOTS = (Path.home() / ".sdkman" / "candidates" / "java", Path("/usr/lib/jvm"))


def is_jdk_home(path):
    """JAVA_HOME 至少要有 bin/java 与 bin/javac，缺一个就跑不了 Maven 编译。"""
    home = Path(path)
    return (home / "bin" / "java").is_file() and (home / "bin" / "javac").is_file()


def _release_info(home):
    """读 JAVA_HOME/release，拿版本与厂商；不起 java 进程。"""
    info = {}
    try:
        with open(Path(home) / "release", "r", encoding="utf-8", errors="replace") as fh:
            for line in fh:
                key, sep, value = line.partition("=")
                if sep and value:
                    info[key.strip()] = value.strip().strip('"')
    except OSError:
        pass
    return info


def discover_jdks(roots=None):
    """扫已装的 JDK。符号链接跳过：current 与发行版默认别名都指向真实目录，列出来只是重复。"""
    out = []
    for _entry, real in iter_home_dirs(roots if roots is not None else JDK_ROOTS, is_jdk_home):
        info = _release_info(real)
        version = info.get("JAVA_VERSION", "")
        vendor = info.get("IMPLEMENTOR", "")
        label = version or real.name
        if vendor:
            label += " · " + vendor
        out.append({"path": str(real), "version": version, "vendor": vendor, "label": label})
    return out


def effective_jdk(jdk):
    """存着的目录还在才用它；不在了回退到当前环境。"""
    return effective_home(jdk, is_jdk_home)


def build_env(jdk, base=None):
    """jdk 非空时换掉 JAVA_HOME，并把它的 bin 放到 PATH 最前；空则原样继承。"""
    return prepend_bin(jdk, base, extra={"JAVA_HOME": jdk})


class JdkStore(HomeStore):
    """工作区到 JAVA_HOME 的映射，存在状态文件旁边，只有网页进程写它。"""

    def __init__(self, path):
        HomeStore.__init__(self, path, "JDK")


def attach_jdks(snapshot, store):
    """把每个工作区选中的 JDK 与失效标记拼进状态回话。"""
    return attach_home(snapshot, store, "jdk", is_jdk_home)


def state_payload(state, jdks, aliases):
    """页面要的整份状态：工作区、模块、服务、运行记录，加上别名与 JDK 选择。"""
    return attach_alias_rel(attach_jdks(state.snapshot(), jdks), aliases)


# 状态文件


class State(StateRows):
    """状态文件只读：写全在 bash 那边、整体替换；页面轮询很密，先比 mtime，没变就不重新解析。"""

    def parse_rows(self, text):
        return parse_rows(text)

    def snapshot(self):
        poms = {}
        workspaces = []
        by_id = {}
        rows = self.rows()
        runs = latest_runs(rows)
        for r in rows:
            if r[0] == WS_KIND:
                item = {"id": r[1], "root": r[2], "added": r[3], "poms": [], "services": []}
                by_id[r[1]] = item
                workspaces.append(item)
            elif r[0] == POM_KIND:
                poms.setdefault(r[2], []).append(r[3])

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
                    "tag": r[1].split(".", 2)[-1],
                    "run": run_info(run) if run else None,
                }
            )

        for ws in workspaces:
            ws["poms"] = sorted(poms.get(ws["id"], []))
            ws["services"].sort(key=lambda s: (s["display"], s["id"]))
        return {"workspaces": workspaces, "now": int(time.time())}


# 引擎




def mvn_argv(module, mvn_args):
    """拼 mvn 命令行。模块单列存放，执行时才拼 -pl，与命令行那边的做法一致。"""
    argv = ["mvn"]
    if module:
        argv += ["-pl", module]
    argv += [w for w in mvn_args.split() if w]
    return argv


class Engine(ToolEngine):
    """mvnx 的执行端：``mvnx --engine`` 守着请求流，断了再拉起来；扫描工程要几秒，不复用就每次重载。"""

    label = "mvnx"

    def __init__(self, mvnx, state, sessions, logs, jdks=None):
        super().__init__(mvnx, state, sessions, logs)
        self.jdks = jdks
        # reserve 到 launched 之间靠 bash 端一个临时文件交接，两次启动不能交错。
        self.start_lock = threading.Lock()

    def engine_env(self):
        return {"MVNX_WEB_ENGINE": "1"}

    # 页面的动作

    def start(self, body):
        """两次启动错开走：reserve 与 launched 之间共用一个临时文件，交错就对不上号。"""
        with self.start_lock:
            return self._start(body)

    def _start(self, body):
        svc = str(body.get("svc", "")).strip()
        row = self.state.find(SVC_KIND, svc)
        if row is None:
            raise ApiError(404, "没有这个服务：%s" % svc)
        # 模块位是 -pl 的值，页面不传就沿用服务行里的，别把它清空。
        module = str(body.get("module", "") or "").strip() or row[SVC_MODULE]
        extra = str(body.get("extra", "") or "").strip()
        mode = str(body.get("mode", "auto") or "auto")
        if mode not in MODES:
            raise ApiError(400, "启动方式不认识：%s" % mode)

        # 同一模块上的动作不能并跑：启动与打包读同一个 target，同工作区的别的模块不受影响。
        # 服务 id 是「工作区.动作.标签」，标签可能带点，从第二段之后整段取。
        parts = svc.split(".", 2)
        tag = parts[2] if len(parts) == 3 else ""
        for run in self.state.runs():
            if run[RUN_STATUS] not in LIVE:
                continue
            if run[CO_WS] == row[CO_WS] and run[CO_TAG] == tag:
                raise ApiError(409, "「%s」正在跑，先停掉" % run[RUN_DISPLAY])

        # 页面上的参数改动要算数：先存进服务行，自动判编译与拼命令都按它来。
        args = (row[SVC_ARGS] + " " + extra).strip() if extra else row[SVC_ARGS]
        if module != row[SVC_MODULE] or args != row[SVC_ARGS]:
            self.call("update", svc, module, args)

        runid, path, mvn_args, gen, _row_line = self.reserve(svc, module, extra, mode)

        log_path = run_log_path(self.logs, runid)
        argv = mvn_argv(module, mvn_args)
        raw_jdk = self.jdks.get(row[CO_WS]) if self.jdks else ""
        jdk = effective_jdk(raw_jdk)
        if raw_jdk and not jdk:
            log("工作区 %s 选的 JDK 已不存在，回退到当前环境：%s" % (row[CO_WS], raw_jdk))
        env = build_env(jdk)
        try:
            sid = self.sessions.spawn(path, argv, log_path, env=env)
        except OSError as exc:
            raise ApiError(500, "起 mvn 失败：%s" % exc)
        self.call("launched", sid, gen)
        return {"run": runid}


# 页面与接口



METRICS = Metrics()


class Handler(ToolHandler):
    server_version = "mvnx-web"

    jdks = None
    # 移出工作区时一并清掉这个工作区选的 JDK。
    home_store = None
    api_prefix = "/__mvnx/api"
    metrics = METRICS

    # 路由

    def build_state(self):
        return state_payload(self.state, self.jdks, self.aliases)

    def _tool_get(self, route, query, method):
        if route == "jdks":
            return {"jdks": discover_jdks(), "current": os.environ.get("JAVA_HOME", "")}
        return NOT_HANDLED

    def _tool_post(self, route, body):
        if route == "jdk":
            ws = str(body.get("ws", "")).strip()
            jdk = str(body.get("jdk", "") or "").strip()
            if not ws or self.state.find(WS_KIND, ws) is None:
                raise ApiError(404, "没有这个工作区：%s" % ws)
            if jdk:
                jdk = os.path.abspath(os.path.expanduser(jdk))
                if not is_jdk_home(jdk):
                    raise ApiError(400, "这个目录不是 JDK：缺 bin/java 或 bin/javac")
            self.jdks.set(ws, jdk)
            return {"ok": True}
        return NOT_HANDLED

    def _tool_update_args(self, body):
        return (
            str(body.get("svc", "")),
            str(body.get("module", "") or ""),
            str(body.get("args", "") or ""),
        )


def serve(args):
    static = check_static(args.static)
    if static is None:
        return 3

    state = State(args.state)
    sessions = Sessions()
    jdks = JdkStore(Path(args.state).parent / "jdk.tsv")
    aliases = AliasStore(Path(args.state).parent / "alias.tsv")
    engine = Engine(os.path.abspath(args.mvnx), state, sessions, args.logs, jdks)

    Handler.static = static
    Handler.state = state
    Handler.sessions = sessions
    Handler.engine = engine
    Handler.jdks = jdks
    Handler.home_store = jdks
    Handler.aliases = aliases
    Handler.logs = str(Path(args.logs).resolve())
    Handler.api_prefix = args.api

    # 状态与指标各一条后台线程，页面开几个都共用这一份。
    Handler.state_stream = StateStream(
        [args.state, Path(args.state).parent / "alias.tsv", Path(args.state).parent / "jdk.tsv"],
        build=lambda: state_payload(state, jdks, aliases),
        tick=lambda: engine.call("tick"),
    )
    Handler.metrics_stream = MetricsStream(METRICS)
    start_streams(Handler.state_stream, Handler.metrics_stream)

    return serve_web(
        Handler,
        args.host,
        args.port,
        ready="MVNX_WEB_READY",
        title="mvnx 网页",
        open_browser=args.open,
    )


def main(argv=None):
    parser = argparse.ArgumentParser(prog="mvnx-web", description="mvnx 网页模式的转发进程")
    parser.add_argument("--static", required=True, help="打包好的页面目录")
    parser.add_argument("--state", required=True, help="状态文件")
    parser.add_argument("--logs", required=True, help="日志目录")
    parser.add_argument("--api", default="/__mvnx/api", help="接口前缀")
    parser.add_argument("--mvnx", required=True, help="mvnx 入口")
    parser.add_argument("--host", default="0.0.0.0", help="监听地址，默认所有网卡")
    parser.add_argument("--port", type=int, default=0, help="监听端口，默认 0 由系统挑")
    parser.add_argument("--open", action="store_true", help="起来后打开浏览器")
    return serve(parser.parse_args(argv))


if __name__ == "__main__":
    sys.exit(main())
