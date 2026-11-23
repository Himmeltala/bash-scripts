"""JVM 引擎的接口：状态、JDK、启停、重扫与日志。

只做参数、工作区映射、权限与调用；工作区、目标与运行记录都在 engines.jvm 里。
"""

import os
import threading
from pathlib import Path

from browse import list_dirs
from engines.jvm.store import KINDS
from netutil import is_loopback_address
from runner import run_log_path
from sse import SSEMixin, tail
from web import ApiError, STREAMED, log

# 这些路由要写状态文件或动进程，POST 之外的方法一律不接。
_WRITE_ROUTES = ("start", "stop", "restart", "update", "jdk", "rescan")


class JvmRoutes(SSEMixin):
    """路由表里 /jvm 一组接口的实现，靠 MRO 混进 Handler。"""

    jvm_app = None

    # 同一个工作区的重扫正在排队或跑着；Handler 每个请求一个新实例，所以放类上。
    _rescan_lock = threading.Lock()
    _rescanning = set()

    def _require_local(self, what):
        """读 JDK 与浏览目录会露出本机情况，默认只认本机；--allow-write 放开。"""
        if getattr(self, "allow_write", False):
            return
        if is_loopback_address(self.client_address[0]):
            return
        raise ApiError(
            403,
            "%s只允许本机发起；要放开给其他机器，用 --allow-write 启动" % what,
        )

    def _jvm_ws(self, wid):
        """idex 工作区 id → JVM 引擎工作区 id；没登记 JVM 的不让动。"""
        tools = self.store.tools(wid) if wid else {}
        jvm = tools.get("jvm") if isinstance(tools, dict) else None
        engine_id = str((jvm or {}).get("id") or "").strip()
        if not engine_id:
            raise ApiError(409, "这个工作区没有登记 JVM 引擎")
        return engine_id

    def _jvm_dispatch(self, method, route, query, body):
        if route == "state":
            return self.jvm_app.state_payload()
        if route == "jdks":
            self._require_local("读取 JDK 列表")
            return {"jdks": self.jvm_app.jdks(), "current": os.environ.get("JAVA_HOME", "")}
        if route == "log":
            return self._jvm_log_page(query)
        if route == "log/stream":
            self._jvm_log_stream(query)
            return STREAMED
        if route == "dirs":
            self._require_local("浏览目录")
            return list_dirs((query.get("path") or [""])[0])

        if route not in _WRITE_ROUTES:
            raise ApiError(404, "没有这个接口：%s" % route)
        if method != "POST":
            raise ApiError(405, "这个接口只接受 POST")
        self._check_write()

        if route == "start":
            return self.jvm_app.start_service(body)
        if route == "stop":
            self.jvm_app.stop_service(str(body.get("run", "") or ""))
            return {"ok": True}
        if route == "restart":
            return self.jvm_app.restart_service(body)
        if route == "update":
            self.jvm_app.update_service(body)
            return {"ok": True}
        if route == "jdk":
            ws = self._jvm_ws(str(body.get("ws", "") or "").strip())
            self.jvm_app.set_jdk(ws, body.get("jdk"))
            return {"ok": True}
        if route == "rescan":
            return self._jvm_rescan(str(body.get("ws", "") or "").strip())
        raise ApiError(404, "没有这个接口：%s" % route)

    def _jvm_log_path(self, runid):
        """运行号只能落在 App 的日志目录里，防止 ../ 读到别处的 *.log。"""
        logs = Path(self.jvm_app.logs).resolve()
        path = run_log_path(logs, runid)
        try:
            path.resolve().relative_to(logs)
        except ValueError:
            raise ApiError(400, "运行号不对")
        return path

    def _jvm_log_page(self, query):
        """日志分页；运行状态从 App 的运行表取，与旧 jvmx 的 _log_page 一致。"""
        runid = (query.get("run") or [""])[0]
        try:
            page = max(0, int((query.get("page") or ["0"])[0] or 0))
        except ValueError:
            page = 0
        text, more = tail(self._jvm_log_path(runid), page)
        run = self.jvm_app.runs.find(runid) or {}
        return {
            "run": runid,
            "status": run.get("status", ""),
            "code": run.get("code", ""),
            "text": text,
            "page": page,
            "more": more,
        }

    def _jvm_rescan(self, wid):
        """重扫一个工作区：引擎状态里没有就按根目录登记，再后台扫描。

        探测到的 ``tools.jvm.id`` 只证明 idex 这边的映射，不代表引擎状态里已有这个
        工作区；直接 scan 未知 id 会报 404。扫描要几秒，放守护线程里做；同一引擎
        工作区同时只允许一条。
        """
        tools = self.store.tools(wid) if wid else {}
        jvm = tools.get("jvm") if isinstance(tools, dict) else None
        if not isinstance(jvm, dict):
            raise ApiError(409, "这个工作区没有登记 JVM")
        engine_id = str(jvm.get("id") or "").strip()
        root = str(jvm.get("root") or "").strip()
        kind = str(jvm.get("kind") or "").strip()
        if not engine_id:
            raise ApiError(409, "这个工作区没有登记 JVM")
        known = self.jvm_app.store.find(engine_id) is not None
        if not known:
            if not root:
                raise ApiError(409, "这个工作区没有登记 JVM 根目录")
            if kind not in KINDS:
                raise ApiError(400, "工作区类型不认识：%s" % kind)
        # 两个 idex 工作区可能指向同一个引擎工作区，按引擎 id 去重。
        key = engine_id

        with self._rescan_lock:
            if key in self._rescanning:
                raise ApiError(409, "这个工作区正在重扫")
            self._rescanning.add(key)

        def run():
            try:
                if known:
                    self.jvm_app.scan(engine_id, strict=False)
                else:
                    ws = self.jvm_app.store.add(root, kind)
                    self.jvm_app.scan(str(ws.get("id") or engine_id), strict=False)
            except ApiError as exc:
                log("重扫 JVM 工作区失败：%s" % exc.message)
            except Exception as exc:
                log("重扫 JVM 工作区出错：%r" % exc)
            finally:
                with self._rescan_lock:
                    self._rescanning.discard(key)

        threading.Thread(target=run, daemon=True).start()
        return {"ok": True, "started": True}

    def _jvm_log_stream(self, query):
        """日志流按 App 的日志目录走；运行日志就在这底下。"""
        self.logs = str(self.jvm_app.logs)
        self._stream_log((query.get("run") or [""])[0])
