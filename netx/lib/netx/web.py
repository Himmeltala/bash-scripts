"""网页看板：JSON 接口、SSE 推送与静态首页。"""

from __future__ import annotations

import json
import signal
import sys
import threading
import time
import webbrowser
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO / "lib" / "py-shared"))

from sse import SSEMixin, sse_data  # noqa: E402
from web import ApiError, WebHandler, WebServer  # noqa: E402

from .collector import Collector  # noqa: E402
from .db import Database  # noqa: E402
from .tracker import FlowTracker  # noqa: E402

STATIC = Path(__file__).resolve().parent / "static"
SSE_INTERVAL = 3.0
DEFAULT_MINUTES = 60.0


def _minutes(query: dict, default: float = DEFAULT_MINUTES) -> float:
    raw = (query.get("minutes") or [""])[0]
    if not raw:
        return default
    try:
        value = float(raw)
    except ValueError:
        raise ApiError(400, "minutes 要是数字")
    if value <= 0:
        raise ApiError(400, "minutes 要大于 0")
    return value


def _limit(query: dict, default: int = 300) -> int:
    raw = (query.get("limit") or [""])[0]
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError:
        raise ApiError(400, "limit 要是整数")
    return max(1, min(value, 2000))


class Handler(SSEMixin, WebHandler):
    static = STATIC
    api_prefix = "/__netx/api"
    db: Database = None  # type: ignore[assignment]
    collector: Collector | None = None

    def _status(self) -> dict:
        if self.collector is not None:
            status = self.collector.status()
        else:
            meta = self.db.meta()
            status = {
                "state": meta.get("collector_state", "stopped"),
                "pid": int(meta.get("collector_pid") or 0),
                "error": meta.get("collector_error", ""),
                "last_event_at": float(meta.get("last_event_at") or 0),
            }
        status["flows"] = self.db.count_flows()
        status["server_time"] = time.time()
        return status

    def _flows(self, query: dict) -> dict:
        rows = self.db.flows(minutes=_minutes(query), limit=_limit(query))
        now = time.time()
        for row in rows:
            row["duration"] = (row["ended"] or now) - row["started"]
        return {"flows": rows, "server_time": now}

    def _dispatch(self, method, route, query, body):
        if method != "GET":
            raise ApiError(405, "这个接口只接受 GET")
        if route == "flows":
            return self._flows(query)
        if route == "status":
            return self._status()
        raise ApiError(404, "没有这个接口：%s" % route)

    def _stream_routes(self, route, query):
        if route != "flows/stream":
            return False
        # 先校验再发响应头：参数错了还能正常回 400，不会在流里再写一份 HTTP。
        payload = self._flows(query)
        self._sse_start()
        try:
            while True:
                payload["status"] = self._status()
                self.wfile.write(sse_data(payload, event="flows").encode("utf-8"))
                self.wfile.flush()
                time.sleep(SSE_INTERVAL)
                payload = self._flows(query)
        except Exception:
            # 头已经发出去了，出错只能断开，不能再套一层 JSON。
            pass
        return True


def make_handler(db: Database, collector: Collector | None = None):
    class _Handler(Handler):
        pass

    _Handler.db = db
    _Handler.collector = collector
    return _Handler


def run(args) -> int:
    from .cli import _require_root

    _require_root("网页")
    from .paths import warn_root_home

    warn_root_home()
    from .paths import acquire_lock

    lock = acquire_lock()
    if lock is None:
        print("netx: 已有采集进程在跑，先停掉它再启动网页", file=sys.stderr)
        return 1
    db = Database(Path(args.db) if args.db else None).init()
    tracker = FlowTracker(db)
    collector = Collector(db, tracker)
    collector.start()
    handler = make_handler(db, collector)
    try:
        server = WebServer((args.host, args.port), handler)
    except OSError as exc:
        collector.stop()
        print("netx: 端口 %d 起不来：%s" % (args.port, exc), file=sys.stderr)
        return 1

    url = "http://%s:%d/" % ("127.0.0.1" if args.host in ("0.0.0.0", "::") else args.host, args.port)
    print("netx: %s" % url)
    if args.open:
        webbrowser.open(url)

    stopping = False

    def _stop(signum, frame):
        nonlocal stopping
        stopping = True
        threading.Thread(target=server.shutdown, daemon=True).start()

    signal.signal(signal.SIGINT, _stop)
    signal.signal(signal.SIGTERM, _stop)
    try:
        server.serve_forever()
    finally:
        collector.stop()
        server.server_close()
    return 0
