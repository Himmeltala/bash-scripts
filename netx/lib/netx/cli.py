"""命令行：看连接、看采集状态、起守护进程与网页。"""

from __future__ import annotations

import argparse
import json
import os
import signal
import sys
import time
from pathlib import Path

from . import VERSION, paths
from .collector import Collector
from .db import Database
from .tracker import FlowTracker


def _human_bytes(value: int) -> str:
    size = float(value)
    for unit in ("B", "KB", "MB", "GB"):
        if size < 1024 or unit == "GB":
            return ("%d %s" % (size, unit)) if unit == "B" else ("%.1f %s" % (size, unit))
        size /= 1024
    return "%d B" % value


def _human_duration(seconds: float) -> str:
    if seconds < 60:
        return "%ds" % max(0, int(seconds))
    if seconds < 3600:
        return "%dm%02ds" % (int(seconds // 60), int(seconds % 60))
    return "%dh%02dm" % (int(seconds // 3600), int(seconds % 3600 // 60))


def _require_root(action: str) -> None:
    if os.geteuid() != 0:
        raise SystemExit("netx: %s需要 root，用 sudo 再跑一次" % action)


def _open_db(args) -> Database:
    return Database(Path(args.db) if args.db else None).init()


def _flows(args) -> int:
    db = _open_db(args)
    minutes = None if args.all else args.minutes
    rows = db.flows(minutes=minutes, limit=args.limit)
    now = time.time()
    if args.json:
        out = []
        for row in rows:
            item = dict(row)
            item["duration"] = (row["ended"] or now) - row["started"]
            out.append(item)
        print(json.dumps(out, ensure_ascii=False, indent=2))
        return 0

    if not rows:
        print("最近没有出网记录。")
        return 0
    header = ("时间", "PID", "进程", "目标", "发送", "时长")
    lines = [header]
    for row in rows:
        started = time.strftime("%H:%M:%S", time.localtime(row["started"]))
        dest = "%s:%d" % (row["dst_ip"], row["dst_port"])
        duration = (row["ended"] or now) - row["started"]
        lines.append(
            (
                started,
                str(row["pid"]),
                row["comm"] or "-",
                dest,
                _human_bytes(row["bytes_out"]),
                _human_duration(duration),
            )
        )
    widths = [max(len(str(line[i])) for line in lines) for i in range(len(header))]
    for line in lines:
        print("  ".join(str(cell).ljust(widths[i]) for i, cell in enumerate(line)).rstrip())
    return 0


def _status(args) -> int:
    db = _open_db(args)
    meta = db.meta()
    payload = {
        "state": meta.get("collector_state", "stopped"),
        "pid": int(meta.get("collector_pid") or 0),
        "error": meta.get("collector_error", ""),
        "last_event_at": float(meta.get("last_event_at") or 0),
        "flows": db.count_flows(),
    }
    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0
    print("采集状态: %s" % payload["state"])
    if payload["pid"]:
        print("采集进程: %d" % payload["pid"])
    if payload["last_event_at"]:
        print("最后事件: %s" % time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(payload["last_event_at"])))
    print("记录条数: %d" % payload["flows"])
    if payload["error"]:
        print("最近错误: %s" % payload["error"])
    return 0


def _make_collector(args) -> tuple[Database, Collector]:
    _require_root("采集")
    paths.warn_root_home()
    db = _open_db(args)
    tracker = FlowTracker(db)
    return db, Collector(db, tracker)


def _daemon(args) -> int:
    _, collector = _make_collector(args)
    lock = paths.acquire_lock()
    if lock is None:
        print("netx: 已有采集进程在跑，先停掉它再启动", file=sys.stderr)
        return 1
    collector.start()
    stopping = False

    def _stop(signum, frame):
        nonlocal stopping
        stopping = True

    signal.signal(signal.SIGINT, _stop)
    signal.signal(signal.SIGTERM, _stop)
    try:
        while not stopping:
            time.sleep(0.5)
    finally:
        collector.stop()
    return 0


def _web(args) -> int:
    from . import web

    return web.run(args)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="netx",
        description="旁路记录 WSL 内的出网连接与发送字节。",
    )
    parser.add_argument("--version", action="version", version="netx %s" % VERSION)
    parser.add_argument("--db", help="sqlite 路径，默认 ~/.cache/netx/netx.db")
    sub = parser.add_subparsers(dest="command")

    flows = sub.add_parser("flows", help="列出最近的出网连接")
    flows.add_argument("--minutes", type=float, default=15, help="最近多少分钟，默认 15")
    flows.add_argument("--all", action="store_true", help="不限时间")
    flows.add_argument("--limit", type=int, default=200, help="最多几条，默认 200")
    flows.add_argument("--json", action="store_true", help="输出 JSON")
    flows.set_defaults(func=_flows)

    status = sub.add_parser("status", help="采集器状态")
    status.add_argument("--json", action="store_true")
    status.set_defaults(func=_status)

    daemon = sub.add_parser("daemon", help="前台跑采集（需要 root）")
    daemon.set_defaults(func=_daemon)

    web = sub.add_parser("web", help="网页看板（需要 root）")
    web.add_argument("--port", type=int, default=8400)
    web.add_argument("--host", default="0.0.0.0")
    web.add_argument("--open", action="store_true", help="打开浏览器")
    web.set_defaults(func=_web)
    return parser


def main(argv=None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.command is None:
        args.minutes = 15
        args.all = False
        args.limit = 200
        args.json = False
        args.db = getattr(args, "db", None)
        return _flows(args)
    return args.func(args)
