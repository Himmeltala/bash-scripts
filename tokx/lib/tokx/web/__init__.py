"""tokx 的网页界面：只读的标准库 HTTP 服务，用量由服务端按 SSE 推给页面。

数据都走 cli._collect，与命令行出表是同一份口径：每轮请求先现扫入库，再从账本统计、
按当前价格表计价，页面拿到的 rows 与 --json 输出里的 rows 完全一样。
服务默认绑所有网卡，局域网里的机器也能打开；只想本机看就用 --host 127.0.0.1。
页面没有登录，也没有写操作，能连上的人都能看用量。
"""

from __future__ import annotations

import argparse
import ipaddress
import json
import mimetypes
import os
import socket
import sys
import threading
import time
from datetime import date
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from .. import cli
from ..config import Config, load
from ..sources import SOURCE_ORDER

# vite 把 web/ 打包成 lib/tokx/web/static，这里只认打包产物；开发时用 web/README.md 里的代理。
STATIC = Path(__file__).resolve().parent / "static"
INDEX = STATIC / "index.html"
# 带内容哈希的资源可以长期缓存。
_CACHED = "public, max-age=31536000, immutable"
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

    # 页面选「全部历史」时不带 days，另外带一个 all=1；range=all 也兼容手拼的地址。
    if first("all") or first("range") == "all":
        args.all = True
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


def _current(config: Config) -> Config:
    """每轮请求重读配置，改了设置文件或价格表不必重启服务。"""
    return load(str(config.path) if config.path else None)


def _stream_seconds(query: dict[str, list[str]]) -> int:
    """推送间隔，默认 5 秒；0 表示只手动刷新，不接受。"""
    text = (query.get("every") or ["5"])[0] or "5"
    try:
        every = int(text)
    except ValueError as exc:
        raise cli.UsageError(f"every {text} 不是整数") from exc
    if not 1 <= every <= 60:
        raise cli.UsageError("every 取 1 到 60 秒")
    return every


def _payload(config: Config, query: dict[str, list[str]]) -> dict:
    config = _current(config)
    args, since, until = _args(config, query)
    data = cli._collect(args.command, args, config, since, until)
    data["now"] = cli.datetime.now(config.book.tz).isoformat(timespec="seconds")
    data["store"] = {"enabled": config.store.enabled, "db": str(config.store.db)}
    return data


def _static_file(path: str) -> Path | None:
    """请求路径对应的打包文件；找不到或跑出目录时回 None，交给 index.html。"""
    try:
        target = (STATIC / (path.lstrip("/") or "index.html")).resolve()
        target.relative_to(STATIC.resolve())
    except (ValueError, OSError):
        return None
    return target if target.is_file() else None


def _content_type(name: Path | None) -> str:
    if name is None or name.suffix == ".html":
        return "text/html; charset=utf-8"
    fixed = {
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".svg": "image/svg+xml",
        ".woff2": "font/woff2",
        ".woff": "font/woff",
        ".ttf": "font/ttf",
    }
    return fixed.get(name.suffix) or mimetypes.guess_type(name.name)[0] or "application/octet-stream"


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
            elif url.path == "/api/usage/stream":
                self._stream_usage(config, query)
            elif url.path == "/api/prices":
                self._json(lambda: cli._price_data(_current(config).book))
            elif url.path.startswith("/api/"):
                self._error(HTTPStatus.NOT_FOUND, f"没有 {url.path}")
            else:
                self._asset(url.path)

        def do_HEAD(self) -> None:  # noqa: N802
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Length", "0")
            self.end_headers()

        def _asset(self, path: str) -> None:
            # 只发打包目录里的文件；路径先解开再核对前缀，防止 ../ 跑出目录。
            name = _static_file(path)
            # 深链接（如 /?command=hour）回落成首页时 name 是 None，不能算带哈希的资源。
            hashed = name is not None and name.parent != STATIC
            try:
                body = name.read_bytes() if name is not None else INDEX.read_bytes()
            except OSError:
                self._error(HTTPStatus.INTERNAL_SERVER_ERROR, "缺少 static/index.html，没有打包前端")
                return
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", _content_type(name if name is not None else INDEX))
            self.send_header("Content-Length", str(len(body)))
            # assets 下的文件名带内容哈希，可以长缓存；页面本身每次核对。
            self.send_header("Cache-Control", _CACHED if hashed else "no-cache")
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

        def _stream_usage(self, config: Config, query: dict[str, list[str]]) -> None:
            """一条长连接按间隔推用量：连上先推当前值，之后每轮重算并重读配置。"""
            try:
                every = _stream_seconds(query)
                with LOCK:
                    payload = _payload(config, query)
            except cli.UsageError as exc:
                self._error(HTTPStatus.BAD_REQUEST, str(exc))
                return
            except Exception as exc:  # noqa: BLE001 - 首次采集失败按普通接口报错
                self._error(HTTPStatus.INTERNAL_SERVER_ERROR, f"{type(exc).__name__}: {exc}")
                return

            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "text/event-stream; charset=utf-8")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "close")
            self.send_header("X-Accel-Buffering", "no")
            self.end_headers()
            self.close_connection = True
            try:
                self._sse_send(payload, "usage")
                while True:
                    time.sleep(every)
                    try:
                        with LOCK:
                            payload = _payload(config, query)
                    except Exception as exc:  # noqa: BLE001 - 单轮失败不掐断流
                        self._sse_send({"error": f"{type(exc).__name__}: {exc}"}, "failure")
                        continue
                    self._sse_send(payload, "usage")
            except (BrokenPipeError, ConnectionResetError):
                pass

        def _sse_send(self, payload: dict, event: str) -> None:
            body = f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False, default=str)}\n\n"
            self.wfile.write(body.encode("utf-8"))
            self.wfile.flush()

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


def is_any(host: str) -> bool:
    """0.0.0.0 与 :: 都是"所有网卡"，不能拿来当访问地址。"""
    return host in ("0.0.0.0", "::")


def lan_address() -> str:
    """猜一个局域网里能用的本机地址，猜不出来退回回环地址；连外部地址只让内核选出口网卡，断网时可能失败。"""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
            probe.connect(("192.0.2.1", 9))  # TEST-NET-1，不会真连上
            address = probe.getsockname()[0]
        if address and not ipaddress.ip_address(address).is_loopback:
            return address
    except OSError:
        pass
    try:
        address = socket.gethostbyname(socket.gethostname())
        if address and not ipaddress.ip_address(address).is_loopback:
            return address
    except OSError:
        pass
    return "127.0.0.1"


def urls(host: str, port: int) -> tuple[str, str]:
    """返回 (对外地址, 本机地址)。"""
    local = f"http://127.0.0.1:{port}/"
    if is_any(host):
        return f"http://{lan_address()}:{port}/", local
    return f"http://{host}:{port}/", local


def serve(
    config: Config,
    host: str = "0.0.0.0",
    port: int = 0,
    open_browser: bool = False,
    as_json: bool = False,
) -> int:
    """起网页界面，一直服务到 Ctrl+C。"""
    if not (0 <= port <= 65535):
        print("tokx: --port 取 0 到 65535", file=sys.stderr)
        return 2
    try:
        httpd = ThreadingHTTPServer((host, port), _make_handler(config))
    except OSError as exc:
        print(f"tokx: 监听 {host}:{port} 失败：{exc}", file=sys.stderr)
        return 1
    port = httpd.server_address[1]
    url, local = urls(host, port)
    if as_json:
        print(json.dumps({"url": url, "local": local, "host": host, "port": port}, ensure_ascii=False))
    else:
        print(f"tokx 网页界面：{url}")
        if url != local:
            print(f"本机 {local}")
        if not is_loopback(host):
            print(
                "页面没有登录，同一网络里能连上的人都能看用量；只想本机看就加 --host 127.0.0.1",
                file=sys.stderr,
            )
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
