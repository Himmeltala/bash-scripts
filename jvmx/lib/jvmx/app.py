"""网页壳的组装：工作区、目标、运行记录与接口。

前端沿用 mvnx 网页那一套形状：工作区列表、服务行、运行记录、别名、分组、JDK。
区别只在于每个工作区还带一个 kind（mvn / gradle），启动时按它选工具。
"""

import os
import shutil
import threading
import time
from pathlib import Path

from browse import list_dirs
from metrics import Metrics
from netutil import is_loopback_address
from runner import run_log_path
from sse import MetricsStream, SSEMixin, StateStream, tail
from toolchain import effective_home, iter_home_dirs, prepend_bin
from web import ApiError, WebHandler, log

from .runs import RunRegistry
from .store import KIND_GRADLE, Store, clean_targets, detect_project, service_id
from .targets import ScanError, default_tools, scan_workspace

# Maven 的四档启动方式，与 mvnx exec --mode 一致。
MVN_MODES = ("auto", "compile", "no-compile", "rebuild")
# Gradle 只认「直接跑」与「先 clean」。
GRADLE_MODES = ("auto", "rebuild")

# 运行记录回给页面的字段；与 mvnx 的 run_info 对齐，页面不用改。
RUN_FIELDS = (
    "id",
    "ws",
    "type",
    "tag",
    "path",
    "module",
    "args",
    "cmd",
    "pid",
    "port",
    "status",
    "started",
    "code",
    "err",
    "display",
)

# 自动扫描的两处：SDKMAN 装的与发行版软件包装的。别处的 JDK 由页面手填路径。
JDK_ROOTS = (Path.home() / ".sdkman" / "candidates" / "java", Path("/usr/lib/jvm"))
# JDK 候选缓存这么久，状态推送很密，不必每轮都扫目录。
JDK_CACHE_SECONDS = 10


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
    """扫已装的 JDK。符号链接跳过：current 之类的别名只是重复。"""
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


def build_env(jdk, base=None):
    """jdk 非空时换掉 JAVA_HOME，并把它的 bin 放到 PATH 最前；空则原样继承。"""
    return prepend_bin(jdk, base, extra={"JAVA_HOME": jdk})


def public_run(run):
    """运行记录去掉内部字段；页面只拿与 mvnx 一致的那一份。"""
    if not run:
        return None
    return dict((key, run.get(key, "")) for key in RUN_FIELDS)


class App:
    """一个 jvmx 网页进程的全部状态。"""

    def __init__(self, home, static=None, allow_write=False, tools=None, jdk_roots=None):
        self.home = Path(home)
        self.home.mkdir(parents=True, exist_ok=True)
        self.logs = self.home / "logs"
        self.logs.mkdir(parents=True, exist_ok=True)
        self.static = Path(static) if static else None
        self.allow_write = allow_write
        self.tools = tools or default_tools()
        self.jdk_roots = tuple(jdk_roots) if jdk_roots is not None else JDK_ROOTS
        self.store = Store(self.home / "state.json")
        self.runs = RunRegistry(self.home / "runs.json", self.logs)
        self.metrics = Metrics()
        self.scan_lock = threading.Lock()
        self._jdks = []
        self._jdks_at = 0.0
        # 状态与指标各一条后台线程，页面开几个都共用这一份。
        self.state_stream = StateStream(
            [self.store.path, self.runs.path],
            build=self.state_payload,
            tick=self.tick,
        )
        self.metrics_stream = MetricsStream(self.metrics)

    # 启停后台

    def start_background(self):
        self.runs.start()
        self.state_stream.start()
        self.metrics_stream.start()

    def close(self):
        self.runs.close()

    def tick(self):
        self.runs.advance()

    # JDK

    def jdks(self):
        now = time.time()
        if now - self._jdks_at >= JDK_CACHE_SECONDS:
            self._jdks = discover_jdks(self.jdk_roots)
            self._jdks_at = now
        return self._jdks

    def jdk_env(self, ws):
        raw = ws.get("jdk") or ""
        jdk = effective_home(raw, is_jdk_home)
        if raw and not jdk:
            log("工作区 %s 选的 JDK 已不存在，回退到当前环境：%s" % (ws["id"], raw))
        return build_env(jdk)

    def set_jdk(self, ws_id, jdk):
        ws = self.store.find(ws_id)
        if ws is None:
            raise ApiError(404, "没有这个工作区：%s" % ws_id)
        jdk = str(jdk or "").strip()
        if jdk:
            jdk = os.path.abspath(os.path.expanduser(jdk))
            if not is_jdk_home(jdk):
                raise ApiError(400, "这个目录不是 JDK：缺 bin/java 或 bin/javac")
        self.store.set_jdk(ws_id, jdk)

    # 目标

    def scan(self, ws_id, strict=True):
        """重新跑工具列目标；失败时留下旧目标并记下原因。"""
        with self.scan_lock:
            ws = self.store.find(ws_id)
            if ws is None:
                raise ApiError(404, "没有这个工作区：%s" % ws_id)
            try:
                raw = scan_workspace(ws, self.tools)
                targets = clean_targets(raw, ws["kind"])
            except (ScanError, ApiError) as exc:
                message = exc.message if isinstance(exc, ApiError) else str(exc)
                self.store.set_targets(ws_id, ws.get("targets") or [], message)
                if strict:
                    raise ApiError(502, message)
                return message
            self.store.set_targets(ws_id, targets)
            return ""

    def add_workspace(self, root):
        if not str(root or "").strip():
            raise ApiError(400, "没给目录")
        detected, kind = detect_project(root)
        ws = self.store.add(detected, kind)
        # 加工作区先成功落盘，扫描失败只记原因，页面仍能看到它并手动重扫。
        error = self.scan(ws["id"], strict=False)
        return {"ok": True, "ws": ws["id"], "scan_error": error}

    def find_service(self, svc_id):
        for ws in self.store.workspaces():
            for target in ws.get("targets") or []:
                if service_id(ws, target) == svc_id:
                    return ws, target
        return None, None

    def services_for(self, ws, latest):
        rows = ws.get("rows") or {}
        out = []
        for target in ws.get("targets") or []:
            sid = service_id(ws, target)
            row = rows.get(sid) or {}
            args = str(row.get("args") or "")
            cmd = str(target.get("display") or "")
            if args:
                cmd = (cmd + " " + args).strip()
            module = str(target.get("path") or "")
            out.append(
                {
                    "id": sid,
                    "type": target.get("command", ""),
                    "path": target.get("cwd") or ws.get("root", ""),
                    "module": module,
                    "args": args,
                    "display": module or ".",
                    "base_cmd": str(target.get("display") or ""),
                    "cmd": cmd,
                    "tag": target.get("tag", ""),
                    "kind": ws.get("kind", ""),
                    "mode": str(row.get("mode") or "auto"),
                    "refresh": bool(row.get("refresh")),
                    "run": public_run(latest.get(sid)),
                }
            )
        out.sort(key=lambda item: (item["display"], item["id"]))
        return out

    def state_payload(self):
        self.runs.advance()
        workspaces = self.store.workspaces()
        groups = self.store.groups()
        group_of = dict(
            (node["id"], node.get("parent") or "")
            for node in groups
            if node.get("kind") == "ws" and node.get("id")
        )
        latest = self.runs.latest_map()
        home = os.path.expanduser("~")
        out = []
        for ws in workspaces:
            try:
                rel = os.path.relpath(ws["root"], home)
            except (TypeError, ValueError):
                rel = ws["root"]
            targets = ws.get("targets") or []
            poms = []
            if ws.get("kind") == "mvn":
                # 模块清单只给页面展示；根项目自身用「.」占位。
                poms = sorted(set(str(t.get("path") or ".") for t in targets))
            jdk = ws.get("jdk") or ""
            out.append(
                {
                    "id": ws["id"],
                    "root": ws["root"],
                    "rel": rel,
                    "alias": ws.get("alias") or "",
                    "group": group_of.get(ws["id"], ""),
                    "added": ws.get("added", 0),
                    "kind": ws.get("kind", ""),
                    "jdk": jdk,
                    "jdk_missing": bool(jdk) and not is_jdk_home(jdk),
                    "poms": poms,
                    "scan_error": ws.get("scan_error") or "",
                    "services": self.services_for(ws, latest),
                }
            )
        return {
            "workspaces": out,
            "groups": groups,
            "jdks": self.jdks(),
            "currentJdk": os.environ.get("JAVA_HOME", ""),
            "now": int(time.time()),
        }

    # 动作

    def start_service(self, body):
        svc_id = str(body.get("svc", "")).strip()
        ws, target = self.find_service(svc_id)
        if ws is None:
            raise ApiError(404, "没有这个服务：%s" % svc_id)
        live = self.runs.live_for(ws["id"], target.get("tag", ""))
        if live is not None:
            raise ApiError(409, "「%s」正在跑，先停掉" % (live.get("cmd") or live.get("display") or svc_id))

        row = self.store.row(ws["id"], svc_id)
        extra = str(body.get("extra") or "").strip()
        args = str(row.get("args") or "")
        if extra:
            args = (args + " " + extra).strip()
        mode = str(body.get("mode") or row.get("mode") or "auto")
        refresh = bool(body.get("refresh")) or bool(row.get("refresh"))
        kind = ws["kind"]
        target_id = target.get("id") or "%s:%s" % (target.get("command"), target.get("tag"))

        if kind == KIND_GRADLE:
            if mode not in GRADLE_MODES:
                raise ApiError(400, "执行方式不认识：%s" % mode)
            argv = list(self.tools["gradle"]) + ["exec", "--id", target_id]
            if mode == "rebuild":
                argv.append("--rebuild")
            if refresh:
                argv.append("--refresh")
        else:
            if mode not in MVN_MODES:
                raise ApiError(400, "启动方式不认识：%s" % mode)
            argv = list(self.tools["mvn"]) + ["exec", "--id", target_id, "--mode", mode]
            if body.get("no_am"):
                argv.append("--no-am")
            if body.get("no_clean"):
                argv.append("--no-clean")
        if args:
            argv += ["--args", args]

        # 页面上带过来的参数也算数，存起来下次启动直接用。
        if extra or body.get("mode") is not None or body.get("refresh") is not None:
            values = {"args": args, "mode": mode}
            if kind == KIND_GRADLE:
                values["refresh"] = refresh
            self.store.set_row(ws["id"], svc_id, values)

        meta = {
            "svc": svc_id,
            "ws": ws["id"],
            "type": target.get("command", ""),
            "tag": target.get("tag", ""),
            "path": ws["root"],
            "module": target.get("path") or "",
            "display": target.get("path") or ".",
            "args": args,
            "cmd": (str(target.get("display") or "") + (" " + args if args else "")).strip(),
        }
        runid = self.runs.create(ws["root"], argv, meta, env=self.jdk_env(ws))
        return {"run": runid}

    def stop_service(self, runid):
        self.runs.stop(str(runid or ""))

    def update_service(self, body):
        svc_id = str(body.get("svc", "")).strip()
        ws, _target = self.find_service(svc_id)
        if ws is None:
            raise ApiError(404, "没有这个服务：%s" % svc_id)
        values = {}
        if "args" in body:
            values["args"] = str(body.get("args") or "").strip()
        if "mode" in body:
            mode = str(body.get("mode") or "auto")
            allowed = GRADLE_MODES if ws["kind"] == KIND_GRADLE else MVN_MODES
            if mode not in allowed:
                raise ApiError(400, "启动方式不认识：%s" % mode)
            values["mode"] = mode
        if "refresh" in body:
            values["refresh"] = bool(body.get("refresh"))
        if values:
            self.store.set_row(ws["id"], svc_id, values)

    def forget_workspace(self, ws_id):
        ws = self.store.find(ws_id)
        if ws is None:
            raise ApiError(404, "没有这个工作区：%s" % ws_id)
        self.runs.stop_workspace(ws_id)
        self.store.remove(ws_id)
        self.runs.remove_workspace(ws_id)
        shutil.rmtree(self.logs / ws_id, ignore_errors=True)

    # 接口组装

    def make_handler(self):
        app = self

        class Handler(SSEMixin, WebHandler):
            server_version = "jvmx/0.1.0"
            api_prefix = "/__jvmx/api"
            static = app.static
            state_stream = app.state_stream
            metrics_stream = app.metrics_stream
            metrics = app.metrics
            logs = str(app.logs)
            allow_write = app.allow_write

            def _is_local(self):
                return self.allow_write or is_loopback_address(self.client_address[0])

            def _require_local(self, what):
                if self._is_local():
                    return
                raise ApiError(
                    403,
                    "%s只允许本机发起；要放开给其他机器，用 --allow-write 启动" % what,
                )

            def _log_path(self, runid):
                logs = Path(self.logs).resolve()
                path = run_log_path(logs, runid)
                try:
                    path.resolve().relative_to(logs)
                except ValueError:
                    raise ApiError(400, "运行号不对")
                return path

            def _stream_routes(self, route, query):
                if route == "state/stream":
                    self._sse([(self.state_stream, "state"), (self.metrics_stream, "metrics")])
                    return True
                if route == "log/stream":
                    self._stream_log((query.get("run") or [""])[0])
                    return True
                if route == "metrics/stream":
                    self._sse([(self.metrics_stream, "metrics")])
                    return True
                return False

            def _log_page(self, query):
                runid = (query.get("run") or [""])[0]
                try:
                    page = max(0, int((query.get("page") or ["0"])[0] or 0))
                except ValueError:
                    page = 0
                text, more = tail(self._log_path(runid), page)
                run = app.runs.find(runid) or {}
                return {
                    "run": runid,
                    "status": run.get("status", ""),
                    "code": run.get("code", ""),
                    "text": text,
                    "page": page,
                    "more": more,
                }

            def _dispatch(self, method, route, query, body):
                if route == "state":
                    return app.state_payload()
                if route == "log":
                    return self._log_page(query)
                if route == "metrics":
                    return self.metrics.snapshot()
                if route == "dirs":
                    self._require_local("浏览目录")
                    return list_dirs((query.get("path") or [""])[0])
                if route == "jdks":
                    self._require_local("读取 JDK 列表")
                    return {"jdks": app.jdks(), "current": os.environ.get("JAVA_HOME", "")}

                if method != "POST":
                    raise ApiError(405, "这个接口只接受 POST")
                self._require_local("写操作")

                if route == "workspaces":
                    return app.add_workspace(str(body.get("root", "")).strip())
                if route == "forget":
                    app.forget_workspace(str(body.get("ws", "")))
                    return {"ok": True}
                if route == "alias":
                    ws = str(body.get("ws", "")).strip()
                    if not ws or app.store.find(ws) is None:
                        raise ApiError(404, "没有这个工作区：%s" % ws)
                    app.store.set_alias(ws, str(body.get("alias", "")))
                    return {"ok": True}
                if route == "groups":
                    return {"ok": True, "groups": app.store.set_groups(body.get("nodes") or [])}
                if route == "rescan":
                    app.scan(str(body.get("ws", "")).strip())
                    return {"ok": True}
                if route == "start":
                    return app.start_service(body)
                if route == "stop":
                    app.stop_service(str(body.get("run", "")))
                    return {"ok": True}
                if route == "update":
                    app.update_service(body)
                    return {"ok": True}
                if route == "jdk":
                    app.set_jdk(str(body.get("ws", "")).strip(), body.get("jdk"))
                    return {"ok": True}
                raise ApiError(404, "没有这个接口：%s" % route)

        return Handler
