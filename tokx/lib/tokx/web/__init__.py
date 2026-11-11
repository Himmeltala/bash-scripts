"""tokx 的网页界面：只读的标准库 HTTP 服务，页面由浏览器定时取 JSON 自己画。

数据都走 cli._collect，与命令行出表是同一份口径：每轮请求都重新现扫、导入账本、
按当前价格表计价，页面拿到的 rows 与 --json 输出里的 rows 完全一样。
服务只绑定回环地址，没有写操作，也没有登录。
"""

from __future__ import annotations

import argparse
import ipaddress
import json
import mimetypes
import os
import sys
import threading
from datetime import date
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from .. import cli
from ..config import Config
from ..sources import SOURCE_ORDER

STATIC = Path(__file__).resolve().parent / "static"
ASSETS = {
    "/": ("index.html", "text/html; charset=utf-8"),
    "/app.js": ("app.js", "text/javascript; charset=utf-8"),
    "/style.css": ("style.css", "text/css; charset=utf-8"),
}
COMMANDS = ("daily", "session", "hour")
# 同时只跑一次扫描，第二个请求排队，免得几个标签页各扫一遍。
LOCK = threading.Lock()


def _parse_date(text: str | None) -> date | None:
    if not text:
        return None
    try:
        return date.fromisoformat(text)
    except ValueError as exc:
        raise cli.UsageError(f"日期 {text} 不是 YYYY-MM-DD") from exc


def _args(config: Config, query: dict[str, list[str]]) -> tuple[argparse.Namespace, date | None, date | None]:
    """把查询串翻译成命令行那套参数，范围规则与命令行完全一致。"""
    def first(name: str) -> str | None:
        values = query.get(name) or []
        return values[0] if values else None

    args = argparse.Namespace()
    command = first("command") or "daily"
    if command not in COMMANDS:
        raise cli.UsageError(f"未知报表 {command}，可选 {'、'.join(COMMANDS)}")
    args.command = command

    sources = [item for item in (first("source") or "").split(",") if item]
    for name in sources:
        if name not in SOURCE_ORDER:
            raise cli.UsageError(f"未知来源 {name}，可选 {'、'.join(SOURCE_ORDER)}")
    if sources:
        args.source = sources

    args.since = _parse_date(first("since"))
    args.until = _parse_date(first("until"))
    days = first("days")
    if days:
        try:
            args.days = int(days)
        except ValueError as exc:
            raise cli.UsageError(f"days {days} 不是整数") from exc
    if args.since or args.until:
        return args, args.since, args.until
    return args, *cli._range(args, config.book)


def _payload(config: Config, query: dict[str, list[str]]) -> dict:
    args, since, until = _args(config, query)
    data = cli._collect(args.command, args, config, since, until)
    data["now"] = cli.datetime.now(config.book.tz).isoformat(timespec="seconds")
    data["store"] = {"enabled": config.store.enabled, "db": str(config.store.db)}
    return data


def _make_handler(config: Config) -> type[BaseHTTPRequestHandler]:
    class Handler(BaseHTTPRequestHandler):
        server_version = f"tokx/{cli.VERSION}"
        sys_version = ""

        def log_message(self, format: str, *args) -> None:  # noqa: A002
            # 默认每个请求往 stderr 打一行，浏览器轮询起来会刷屏；只在调试时打开。
            if os.environ.get("TOKX_WEB_VERBOSE"):
                super().log_message(format, *args)

        def do_GET(self) -> None:  # noqa: N802
            url = urlsplit(self.path)
            query = parse_qs(url.query)
            if url.path == "/api/usage":
                self._json(lambda: _payload(config, query))
            elif url.path == "/api/prices":
                self._json(lambda: cli._price_data(config.book))
            elif url.path in ASSETS:
                self._asset(url.path)
            else:
                self._error(HTTPStatus.NOT_FOUND, f"没有 {url.path}")

        def do_HEAD(self) -> None:  # noqa: N802
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Length", "0")
            self.end_headers()

        def _asset(self, path: str) -> None:
            name, kind = ASSETS[path]
            try:
                body = (STATIC / name).read_bytes()
            except OSError:
                self._error(HTTPStatus.INTERNAL_SERVER_ERROR, f"缺少 {name}，重装 tokx")
                return
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", kind or mimetypes.guess_type(name)[0] or "application/octet-stream")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(body)

        def _json(self, build) -> None:
            with LOCK:
                try:
                    payload = build()
                except cli.UsageError as exc:
                    self._error(HTTPStatus.BAD_REQUEST, str(exc))
                    return
                except Exception as exc:  # noqa: BLE001 - 采集失败也要把原因带回页面
                    self._error(HTTPStatus.INTERNAL_SERVER_ERROR, f"{type(exc).__name__}: {exc}")
                    return
            body = json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def _error(self, status: HTTPStatus, message: str) -> None:
            body = json.dumps({"error": message}, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    return Handler


def parse_host(text: str) -> str:
    if text == "localhost":
        return text
    try:
        ipaddress.ip_address(text)
    except ValueError as exc:
        raise cli.UsageError(f"--host {text} 不是 IP 地址") from exc
    return text


def is_loopback(host: str) -> bool:
    if host == "localhost":
        return True
    return ipaddress.ip_address(host).is_loopback


def serve(
    config: Config,
    host: str = "127.0.0.1",
    port: int = 0,
    open_browser: bool = False,
    as_json: bool = False,
) -> int:
    """起网页界面，一直服务到 Ctrl+C。"""
    if not (0 <= port <= 65535):
        print("tokx: --port 取 0 到 65535", file=sys.stderr)
        return 2
    # 不绑回环又没开认证，等于把用量和接口地址给局域网里的人看，必须显式承认。
    if not is_loopback(host) and not os.environ.get("TOKX_WEB_PUBLIC"):
        print(
            f"tokx: {host} 不是回环地址，网页没有登录，任何能连上的人都能看用量；"
            "确实要这样做就设环境变量 TOKX_WEB_PUBLIC=1",
            file=sys.stderr,
        )
        return 2
    try:
        httpd = ThreadingHTTPServer((host, port), _make_handler(config))
    except OSError as exc:
        print(f"tokx: 监听 {host}:{port} 失败：{exc}", file=sys.stderr)
        return 1
    port = httpd.server_address[1]
    url = f"http://{host if host != '0.0.0.0' else '127.0.0.1'}:{port}/"
    if as_json:
        print(json.dumps({"url": url, "host": host, "port": port}, ensure_ascii=False))
    else:
        print(f"tokx 网页界面：{url}")
        print("按 Ctrl+C 退出。", file=sys.stderr)
    sys.stdout.flush()
    if open_browser:
        threading.Thread(target=_open, args=(url,), daemon=True).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()
    return 0


def _open(url: str) -> None:
    import webbrowser

    try:
        webbrowser.open(url)
    except Exception:  # noqa: BLE001 - 打不开浏览器不影响服务本身
        pass
