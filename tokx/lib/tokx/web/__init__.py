"""tokx 的网页界面：只读的标准库 HTTP 服务，用量由服务端按 SSE 推给页面。

数据都走 cli._collect，与命令行出表是同一份口径：每轮请求先现扫入库，再从账本统计、
按当前价格表计价，页面拿到的 rows 与 --json 输出里的 rows 完全一样。
服务默认绑所有网卡，局域网里的机器也能打开；只想本机看就用 --host 127.0.0.1。
页面没有登录，也没有写操作，能连上的人都能看用量。
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import sys
import threading
import time
from datetime import date
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler
from pathlib import Path

# 共用骨架在仓库根的 lib/py-shared 下，源码与安装后的相对层级一致。
sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "lib" / "py-shared"))
import netutil
import pathutil
from sse import SSE_INTERVAL, SSEMixin, sse_data
from web import ApiError, WebHandler, WebServer

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
    """推送间隔，默认与共享层一致取 5 秒；0 表示只手动刷新，不接受。"""
    default = str(int(SSE_INTERVAL))
    text = (query.get("every") or [default])[0] or default
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
    # tokx 没有子目录首页：目录不补 index，交给 _asset 回落到根 index.html。
    target = pathutil.static_target(STATIC, path, index="")
    return target if target is not None and target.is_file() else None


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


def _guarded(build):
    """采集一次并翻成 ApiError：UsageError 是 400，其余异常按 500 带回类型名。"""
    with LOCK:
        try:
            return build()
        except cli.UsageError as exc:
            raise ApiError(HTTPStatus.BAD_REQUEST, str(exc))
        except Exception as exc:  # noqa: BLE001 - 采集失败也要把原因带回页面
            raise ApiError(HTTPStatus.INTERNAL_SERVER_ERROR, f"{type(exc).__name__}: {exc}")


def _make_handler(config: Config) -> type[BaseHTTPRequestHandler]:
    class Handler(SSEMixin, WebHandler):
        server_version = f"tokx/{cli.VERSION}"
        sys_version = ""
        api_prefix = "/api/"
        static = STATIC

        def log_message(self, format: str, *args) -> None:  # noqa: A002
            # 默认每个请求往 stderr 打一行，浏览器轮询起来会刷屏；只在调试时打开。
            if os.environ.get("TOKX_WEB_VERBOSE"):
                BaseHTTPRequestHandler.log_message(self, format, *args)

        def do_HEAD(self) -> None:  # noqa: N802
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Length", "0")
            self.end_headers()

        def do_POST(self) -> None:  # noqa: N802
            # 页面只读，没有任何写接口；与 BaseHTTPRequestHandler 的默认回话一致。
            self.send_error(HTTPStatus.NOT_IMPLEMENTED)

        def _dispatch(self, method, route, query, body):
            if route == "usage":
                return _guarded(lambda: _payload(config, query))
            if route == "prices":
                return _guarded(lambda: cli._price_data(_current(config).book))
            raise ApiError(HTTPStatus.NOT_FOUND, f"没有 /api/{route}")

        def _stream_routes(self, route, query):
            if route != "usage/stream":
                return False
            self._stream_usage(config, query)
            return True

        def _static(self, path: str, head: bool = False) -> None:
            # 只发打包目录里的文件；路径先解开再核对前缀，防止 ../ 跑出目录。
            name = _static_file(path)
            # 深链接（如 /?command=hour）回落成首页时 name 是 None，不能算带哈希的资源。
            hashed = name is not None and name.parent != STATIC
            try:
                body = b"" if head else (name.read_bytes() if name is not None else INDEX.read_bytes())
            except OSError:
                self._error(HTTPStatus.INTERNAL_SERVER_ERROR, "缺少 static/index.html，没有打包前端")
                return
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", _content_type(name if name is not None else INDEX))
            self.send_header("Content-Length", str(len(body)))
            # assets 下的文件名带内容哈希，可以长缓存；页面本身每次核对。
            self.send_header("Cache-Control", _CACHED if hashed else "no-cache")
            self.end_headers()
            if body:
                self.wfile.write(body)

        def _stream_usage(self, config: Config, query: dict[str, list[str]]) -> None:
            """一条长连接按间隔推用量：连上先推当前值，之后每轮重算并重读配置。"""
            try:
                every = _stream_seconds(query)
                with LOCK:
                    payload = _payload(config, query)
            except cli.UsageError as exc:
                raise ApiError(HTTPStatus.BAD_REQUEST, str(exc))
            except Exception as exc:  # noqa: BLE001 - 首次采集失败按普通接口报错
                raise ApiError(HTTPStatus.INTERNAL_SERVER_ERROR, f"{type(exc).__name__}: {exc}")

            self._sse_start()
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
            body = sse_data(payload, event=event, json_default=str)
            self.wfile.write(body.encode("utf-8"))
            self.wfile.flush()

        def _json(self, status: int, payload) -> None:
            body = json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def _error(self, status: int, message: str) -> None:
            body = json.dumps({"error": message}, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    return Handler


def parse_host(text: str) -> str:
    try:
        return netutil.parse_host(text)
    except ValueError as exc:
        raise cli.UsageError(str(exc)) from exc


def is_loopback(host: str) -> bool:
    return netutil.is_loopback_host(host)


def urls(host: str, port: int) -> tuple[str, str]:
    """返回 (对外地址, 本机地址)。"""
    local = netutil.host_url("127.0.0.1", port)
    return netutil.host_url(host, port), local


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
        # 客户端提前断开不算错误：共用 WebServer 已经按这个口径处理。
        httpd = WebServer((host, port), _make_handler(config))
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
