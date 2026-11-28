# @Author: Himmeltala
# @Date: 2026-11-26 09:29:54
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-26 09:29:54
# @FilePath: \idex\src\idex\engines\jvm\engine.py
# @Description: JVM 引擎的组装：工作区、目标、运行记录与状态。

"""每个工作区带一个 kind（mvn / gradle），启动时按它选工具；目标由 mvnx / gradlex 扫描。"""

import os
import shutil
import threading
import time
from pathlib import Path

from metrics import Metrics
from sse import MetricsStream, StateStream
from stores import LayoutStore
from toolchain import effective_home, iter_home_dirs, prepend_bin
from web import ApiError, log

from .runs import LIVE, RunRegistry
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
    "artifact",
)

# 自动扫描的两处：SDKMAN 装的与发行版软件包装的。别处的 JDK 由页面手填路径。
JDK_ROOTS = (Path.home() / ".sdkman" / "candidates" / "java", Path("/usr/lib/jvm"))
# JDK 候选缓存这么久，状态推送很密，不必每轮都扫目录；新装的 JDK 最多晚一分钟出现。
JDK_CACHE_SECONDS = 60


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
    out = dict((key, run.get(key, "")) for key in RUN_FIELDS)
    artifact = run.get("artifact")
    # 磁盘路径留在服务端，页面只需要文件名与大小。
    if isinstance(artifact, dict):
        out["artifact"] = {"name": artifact.get("name", ""), "size": artifact.get("size", 0)}
    return out


class App:

    def __init__(self, home, tools=None, jdk_roots=None):
        self.home = Path(home)
        self.home.mkdir(parents=True, exist_ok=True)
        self.logs = self.home / "logs"
        self.logs.mkdir(parents=True, exist_ok=True)
        self.tools = tools or default_tools()
        self.jdk_roots = tuple(jdk_roots) if jdk_roots is not None else JDK_ROOTS
        self.store = Store(self.home / "state.json")
        self.groups = LayoutStore(self.home / "groups.json")
        # 旧版把分组放在 state.json 里，取出来放进 groups.json 之后就不再回头读。
        legacy_groups = self.store.take_groups()
        if legacy_groups and not self.groups.nodes():
            self.groups.set(legacy_groups)
        self.runs = RunRegistry(self.home / "runs.json", self.logs)
        self.metrics = Metrics()
        # 扫描按工作区各一把锁：一个工程扫得慢，别挡住别的工作区。
        self.scan_lock = threading.Lock()
        self.scan_locks = {}
        self._home = os.path.expanduser("~")
        # 状态推送的静态部分缓存：工作区记录没变就不重算。
        self._static_cache = {}
        self._jdks = []
        self._jdks_at = 0.0
        # 状态与指标各一条后台线程，页面开几个都共用这一份。
        self.state_stream = StateStream(
            [self.store.path, self.groups.path, self.runs.path],
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
        """收掉运行记录与状态、指标推送线程；已经起的服务进程不归这里管。"""
        self.runs.close()
        for stream in (self.state_stream, self.metrics_stream):
            try:
                stream.stop()
            except Exception:
                pass

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

    def scan_lock_for(self, ws_id):
        """同一个工作区的扫描串行，不同的互不影响。"""
        with self.scan_lock:
            lock = self.scan_locks.get(ws_id)
            if lock is None:
                lock = self.scan_locks[ws_id] = threading.Lock()
            return lock

    def scan(self, ws_id, strict=True):
        """重新跑工具列目标；失败时留下旧目标并记下原因。"""
        with self.scan_lock_for(ws_id):
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

    # 每次推送都要拼的静态字段：相对路径、别名、JDK 检查、模块清单。
    # 工作区记录没变就复用上次算好的，服务行仍按运行表每次重拼。
    def _ws_static(self, ws):
        targets = ws.get("targets") or []
        paths = tuple(str(t.get("path") or ".") for t in targets)
        fingerprint = (
            ws.get("root"),
            ws.get("alias") or "",
            ws.get("jdk") or "",
            ws.get("kind", ""),
            ws.get("added", 0),
            paths,
        )
        cached = self._static_cache.get(ws.get("id"))
        if cached is not None and cached[0] == fingerprint:
            return cached[1]
        try:
            rel = os.path.relpath(ws["root"], self._home)
        except (TypeError, ValueError):
            rel = ws["root"]
        jdk = ws.get("jdk") or ""
        data = {
            "rel": rel,
            "jdk": jdk,
            "jdk_missing": bool(jdk) and not is_jdk_home(jdk),
            # 模块清单只给页面展示；根项目自身用「.」占位。
            "poms": sorted(set(paths)) if ws.get("kind") == "mvn" else [],
        }
        self._static_cache[ws.get("id")] = (fingerprint, data)
        return data

    def runs_summary(self):
        """顶栏运行清单：每个服务最新一条，字段与状态页签的 run 对齐。"""
        rows = []
        for svc, run in self.runs.latest_map().items():
            rows.append(
                {
                    "ws": run.get("ws", ""),
                    "svc": svc,
                    "id": run.get("id", ""),
                    "type": run.get("type", ""),
                    "tag": run.get("tag", ""),
                    "display": run.get("display", ""),
                    "cmd": run.get("cmd", ""),
                    "port": run.get("port", ""),
                    "status": run.get("status", ""),
                    "started": run.get("started", 0),
                }
            )
        return {"runs": rows}

    def state_payload(self):
        self.runs.advance()
        workspaces = self.store.workspaces()
        groups = self.groups.nodes()
        group_of = dict(
            (node["id"], node.get("parent") or "")
            for node in groups
            if node.get("kind") == "ws" and node.get("id")
        )
        latest = self.runs.latest_map()
        out = []
        for ws in workspaces:
            static = self._ws_static(ws)
            out.append(
                {
                    "id": ws["id"],
                    "root": ws["root"],
                    "rel": static["rel"],
                    "alias": ws.get("alias") or "",
                    "group": group_of.get(ws["id"], ""),
                    "added": ws.get("added", 0),
                    "kind": ws.get("kind", ""),
                    "jdk": static["jdk"],
                    "jdk_missing": static["jdk_missing"],
                    "poms": static["poms"],
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
        stopping = self.runs.stopping_for(ws["id"], target.get("tag", ""))
        if stopping is not None:
            raise ApiError(409, "「%s」正在停止，等退出后再启动" % (stopping.get("display") or svc_id))

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
            # 启动类命令先补装改动过的兄弟模块，否则改了兄弟模块的源码会报找不到符号；
            # 跳过编译时不加，免得违背「不编译」。
            if target.get("command") in ("run", "war") and mode != "no-compile":
                argv.append("--deps")
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

    def artifact_path(self, runid):
        """下载入口按运行号反查，只认该运行 target 目录里记下的那个文件。"""
        run = self.runs.find(str(runid or ""))
        artifact = (run or {}).get("artifact") or {}
        if not isinstance(artifact, dict) or not artifact.get("path"):
            return None
        path = Path(str(artifact["path"])).resolve()
        base = (
            Path(str(run.get("path") or "")) / str(run.get("module") or "") / "target"
        ).resolve()
        try:
            path.relative_to(base)
        except ValueError:
            return None
        return path if path.is_file() else None

    def restart_service(self, body):
        """停掉再按原参数起一份：stop 会等进程组退干净，随后 start 才能占回端口。"""
        runid = str(body.get("run") or "")
        run = self.runs.find(runid)
        if run is None or run.get("status") not in LIVE:
            raise ApiError(409, "这个服务没有在跑")
        self.runs.stop(runid)
        # 停止改成后台收进程，重启得等旧进程真退干净才能占回端口。
        if not self.runs.wait_stopped(runid):
            raise ApiError(409, "停止还没完成，稍后再重启")
        return self.start_service({"svc": run.get("svc", "")})

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
        self._static_cache.pop(ws_id, None)
        self.groups.drop("ws", ws_id)
        self.runs.remove_workspace(ws_id)
        shutil.rmtree(self.logs / ws_id, ignore_errors=True)
