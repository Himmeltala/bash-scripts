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
import codecs
import json
import os
import queue
import re
import signal
import socket
import sys
import threading
import time
import webbrowser
from pathlib import Path
from urllib.parse import parse_qs, urlparse

# 共用骨架在仓库根的 lib/py-shared 下，源码与安装后的相对层级一致。
sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "lib" / "py-shared"))
from browse import list_dirs
from metrics import Metrics
from runner import (
    RUN_FIELDS,
    EngineClient,
    Sessions,
    StateRows,
    latest_runs,
    parse_fixed_rows,
    run_info,
    run_log_path,
)
from sse import (
    LineBuffer,
    MetricsStream,
    SSEMixin,
    StateStream,
    last_lines,
    log_page,
    sse_data,
    sse_event,
    tail,
)
from stores import FS, AliasStore, LineStore, Row, attach_alias_rel
from toolchain import effective_home, iter_home_dirs, prepend_bin
from web import ApiError, STREAMED, WebHandler, WebServer, guess_host, is_any, log

# 状态行的列，与 lib/mvnx/server.sh 里的 web_col 一致，0 起。
WS_KIND, SVC_KIND, POM_KIND, RUN_KIND = "ws", "svc", "pom", "run"
LIVE = ("starting", "ready")
# 运行号是「服务 id.纳秒」：去掉末尾那一段就是服务 id。
RUN_PREFIX_RE = re.compile(r"\.[0-9]+$")
MODES = ("auto", "compile", "no-compile", "rebuild")
# 行内列号（0 起）。svc 行与 run 行的公共段：id 1、工作区 2、类型 3、标签 4。
CO_ID, CO_WS, CO_TYPE, CO_TAG = 1, 2, 3, 4
# svc 行：-pl 的值第 5 列、mvn 参数第 6 列。
SVC_MODULE, SVC_ARGS = 5, 6
# run 行（17 段，0 起）：展示路径第 7 列、会话号 11、端口 12、状态 13。
RUN_DISPLAY = 7
RUN_PID, RUN_PORT, RUN_STATUS = 11, 12, 13
# run 行第 1 段是类型 run，第 2 段起依次是这 16 个字段，顺序与 lib/mvnx/server.sh 的 web_run_line 一致。
# （RUN_FIELDS 由共享层给出，这里仍以同名留在模块顶层。）


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


class JdkStore(LineStore):
    """工作区到 JAVA_HOME 的映射，存在状态文件旁边，只有网页进程写它。"""

    def __init__(self, path):
        LineStore.__init__(self, path, allow_empty=True, on_error=self._write_failed)

    def _write_failed(self, exc):
        log("写 JDK 设置失败 %s：%s" % (self.path, exc))

    def get(self, ws):
        return LineStore.get(self, ws, "")

    def set(self, ws, jdk):
        # 空值仍然表示「删掉这一行」，与以前的状态文件格式保持一致。
        if jdk:
            LineStore.set(self, ws, jdk)
        else:
            LineStore.remove(self, ws)


def attach_jdks(snapshot, store):
    """把每个工作区选中的 JDK 与失效标记拼进状态回话。"""
    for ws in snapshot.get("workspaces", []):
        jdk = store.get(ws["id"])
        ws["jdk"] = jdk
        ws["jdk_missing"] = bool(jdk) and not is_jdk_home(jdk)
    return snapshot


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


class Engine(EngineClient):
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

    def add_workspace(self, root):
        self.call("add", root)

    def remove_workspace(self, ws):
        for run in self.state.runs(ws):
            if run[RUN_STATUS] in LIVE:
                self.sessions.kill_group(run[RUN_PID])
        # 正在跑的先停，再让 bash 删登记。
        self.call("remove", ws)

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

        first = self.call("reserve", svc, module, extra, mode)
        parts = first.split(FS)
        # 回话是「运行号|目录|参数|预排行|代次」：预排行自己带着分隔符，段数不定。
        # 前四段取头部，代次取最后一段，中间那串就是预排行。
        if len(parts) < 5:
            raise ApiError(500, "mvnx 没有给出启动参数：%r" % first)
        if parts[0] == "":
            parts = parts[1:]
        runid, path, mvn_args = parts[0], parts[1], parts[2]
        gen = parts[-1]
        row_line = FS.join(parts[3:-1])

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

    def stop(self, runid):
        run = self.state.find(RUN_KIND, runid)
        if run is None or run[RUN_STATUS] not in LIVE:
            raise ApiError(409, "这个服务没有在跑")
        self.sessions.kill_group(run[RUN_PID])
        self.call("stop", runid)


# 页面与接口



METRICS = Metrics()


class Handler(SSEMixin, WebHandler):
    server_version = "mvnx-web"

    static = None
    state = None
    sessions = None
    engine = None
    jdks = None
    aliases = None
    logs = None
    state_stream = None
    metrics_stream = None
    api_prefix = "/__mvnx/api"


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
            return state_payload(self.state, self.jdks, self.aliases)
        if route == "log":
            return self._log(query)
        if route == "dirs":
            return list_dirs((query.get("path") or [""])[0])
        if route == "jdks":
            return {"jdks": discover_jdks(), "current": os.environ.get("JAVA_HOME", "")}
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
            self.jdks.remove(ws)
            if self.aliases is not None:
                self.aliases.set(ws, "")
            return {"ok": True}
        if route == "alias":
            ws = str(body.get("ws", "")).strip()
            if not ws or self.state.find(WS_KIND, ws) is None:
                raise ApiError(404, "没有这个工作区：%s" % ws)
            self.aliases.set(ws, str(body.get("alias", "")))
            return {"ok": True}
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
        if route == "start":
            return engine.start(body)
        if route == "stop":
            engine.stop(str(body.get("run", "")))
            return {"ok": True}
        if route == "update":
            engine.call(
                "update",
                str(body.get("svc", "")),
                str(body.get("module", "") or ""),
                str(body.get("args", "") or ""),
            )
            return {"ok": True}
        raise ApiError(404, "没有这个接口：%s" % route)


    def _log(self, query):
        return log_page(self.state, self.logs, query, RUN_KIND)


def serve(args):
    static = Path(args.static).resolve()
    if not (static / "index.html").is_file():
        log("缺 %s/index.html，前端还没打包" % static)
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

    # mvnx 守着这一行等它就绪；端口填 0 时这里报的是真正用上的那个。
    print("MVNX_WEB_READY %s:%d" % (host, port), flush=True)
    log("mvnx 网页：%s" % url)

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
