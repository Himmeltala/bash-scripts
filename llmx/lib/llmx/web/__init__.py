"""llmx 的网页界面：只读的标准库 HTTP 服务，用量由服务端按 SSE 推给页面。

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
sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "lib" / "py-shared" / "commons"))
sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "lib" / "py-shared" / "services"))
import fileio
import metrics as metrics_mod
import netutil
import pathutil
from runtime import serve as serve_web
from sse import MetricsStream, SSE_INTERVAL, SSE_PING_SECONDS, SSEMixin, sse_data
from web import ApiError, WebHandler

from .. import cli, profiles, sessions
from ..config import Config, ConfigError, config_path, load, render, validate_text
from ..sources import SOURCE_ORDER

# vite 把 web/ 打包成 lib/llmx/web/static，这里只认打包产物；开发时用 web/README.md 里的代理。
STATIC = Path(__file__).resolve().parent / "static"
INDEX = STATIC / "index.html"
COMMANDS = ("daily", "session", "hour", "project", "api")
# 同时只跑一次扫描，第二个请求排队，免得几个标签页各扫一遍。
LOCK = threading.Lock()
# 页面头部的性能指标只采一份给所有页面。
METRICS_STREAM = MetricsStream(metrics_mod.Metrics())
_METRICS_LOCK = threading.Lock()
_METRICS_STARTED = False


def _start_metrics() -> None:
    """指标后台线程只起一次；多次建 Handler 不会多出几条采样线程。"""
    global _METRICS_STARTED
    with _METRICS_LOCK:
        if not _METRICS_STARTED:
            METRICS_STREAM.start()
            _METRICS_STARTED = True


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
    """推送间隔，默认与共享层一致取 3 秒；0 表示只手动刷新，不接受。"""
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
    # 页面只用 rows 与 totals；不加时间戳，数据没变时这一份才好拿去和上一份比对。
    return cli._collect(args.command, args, config, since, until)


def _static_file(path: str) -> Path | None:
    """请求路径对应的打包文件；找不到或跑出目录时回 None，交给 index.html。"""
    # llmx 没有子目录首页：目录不补 index，交给 _asset 回落到根 index.html。
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


def _first(query: dict[str, list[str]], name: str) -> str:
    values = query.get(name) or []
    return values[0] if values else ""


def _manage(build):
    """配置档与会话的失败翻成 400，消息原样给页面。"""
    try:
        return build()
    except (profiles.ProfileError, sessions.SessionError) as exc:
        raise ApiError(HTTPStatus.BAD_REQUEST, str(exc))


def _guarded(build):
    """采集一次并翻成 ApiError：UsageError 是 400，其余异常按 500 带回类型名。"""
    with LOCK:
        try:
            return build()
        except cli.UsageError as exc:
            raise ApiError(HTTPStatus.BAD_REQUEST, str(exc))
        except Exception as exc:  # noqa: BLE001 - 采集失败也要把原因带回页面
            raise ApiError(HTTPStatus.INTERNAL_SERVER_ERROR, f"{type(exc).__name__}: {exc}")


def _make_handler(config: Config, allow_write: bool = False) -> type[BaseHTTPRequestHandler]:
    class Handler(SSEMixin, WebHandler):
        server_version = f"llmx/{cli.VERSION}"
        sys_version = ""
        api_prefix = "/api/"
        static = STATIC
        # 头部指标走一条独立推送，与用量那条互不影响。
        metrics_stream = METRICS_STREAM
        # 写操作默认只认本机；--allow-write 把它放开给所有能打开页面的人。
        allow_write = False

        def log_message(self, format: str, *args) -> None:  # noqa: A002
            # 默认每个请求往 stderr 打一行，浏览器轮询起来会刷屏；只在调试时打开。
            if os.environ.get("LLMX_WEB_VERBOSE"):
                BaseHTTPRequestHandler.log_message(self, format, *args)

        def do_HEAD(self) -> None:  # noqa: N802
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Length", "0")
            self.end_headers()

        def do_POST(self) -> None:  # noqa: N802
            # 只有价格配置能写，且默认只认本机；跨站写请求由共用的 WebHandler 挡。
            self._route("POST")

        def _dispatch(self, method, route, query, body):
            if route == "config":
                if method == "POST":
                    return self._config_save(body)
                return self._config_get()
            if route == "usage":
                return _guarded(lambda: _payload(config, query))
            if route == "prices":
                return _guarded(lambda: cli._price_data(_current(config).book))
            parts = [part for part in route.split("/") if part]
            if parts[:2] == ["profiles", "claude"]:
                return self._profiles(method, parts[2:], query, body)
            if parts[:2] == ["claude", "settings"]:
                self._require_local("读取生效配置")
                return _manage(lambda: profiles.current_settings(config.paths))
            if parts[:2] == ["claude", "memory"]:
                return self._memory(method, body)
            if parts[:2] == ["claude", "sessions"]:
                return self._sessions(method, parts[2:], query, body)
            raise ApiError(HTTPStatus.NOT_FOUND, f"没有 /api/{route}")

        def _profiles(self, method, rest, query, body):
            """配置档：清单、单份内容、增删改与整份应用。"""
            if not rest:
                if method != "GET":
                    raise ApiError(HTTPStatus.METHOD_NOT_ALLOWED, "配置档清单只支持 GET")
                data = _manage(lambda: profiles.list_profiles(config.paths))
                data["writable"] = self._is_local()
                return data
            action = rest[0]
            if action in ("file", "diff") and method == "GET":
                self._require_local("读取配置档")
                name = _first(query, "name")
                if action == "diff":
                    return _manage(lambda: profiles.settings_diff(config.paths, name))
                return _manage(lambda: profiles.read_profile(config.paths, name))
            if method != "POST":
                raise ApiError(HTTPStatus.METHOD_NOT_ALLOWED, f"配置档操作 {action} 只支持 POST")
            self._require_local("写操作")
            paths = config.paths
            if action == "create":
                return _manage(
                    lambda: profiles.create_profile(
                        paths,
                        body.get("name"),
                        body.get("from") or "blank",
                        body.get("source"),
                    )
                )
            if action == "save":
                return _manage(lambda: profiles.save_profile(paths, body.get("name"), body.get("text")))
            if action == "rename":
                return _manage(lambda: profiles.rename_profile(paths, body.get("from"), body.get("to")))
            if action == "delete":
                return _manage(lambda: profiles.delete_profile(paths, body.get("name")))
            if action == "apply":
                return _manage(lambda: profiles.apply_profile(paths, body.get("name")))
            raise ApiError(HTTPStatus.NOT_FOUND, f"没有 /api/profiles/claude/{action}")

        def _memory(self, method, body):
            self._require_local("读写 CLAUDE.md")
            paths = config.paths
            if method == "POST":
                return _manage(lambda: profiles.write_memory(paths, body.get("text")))
            data = _manage(lambda: profiles.read_memory(paths))
            data["writable"] = self._is_local()
            return data

        def _sessions(self, method, rest, query, body):
            current = _current(config)
            if not rest:
                if method != "GET":
                    raise ApiError(HTTPStatus.METHOD_NOT_ALLOWED, "会话清单只支持 GET")
                data = _manage(lambda: sessions.list_sessions(current))
                data["writable"] = self._is_local()
                return data
            if rest[0] == "detail" and method == "GET":
                session_id = _first(query, "id")
                return _manage(lambda: sessions.detail(current, session_id))
            if rest[0] == "delete" and method == "POST":
                return _manage(lambda: sessions.trash(current, body.get("ids")))
            raise ApiError(HTTPStatus.NOT_FOUND, f"没有 /api/claude/sessions/{rest[0]}")


        def _config_path(self):
            """显式 --config 给的那份，或者默认缓存目录里的那一份。"""
            return config.path or config_path()

        def _config_get(self):
            path = self._config_path()
            if path.is_file():
                try:
                    text = path.read_text(encoding="utf-8")
                except OSError as exc:
                    raise ApiError(HTTPStatus.FORBIDDEN, f"读不了配置文件：{exc}")
                except UnicodeDecodeError:
                    raise ApiError(HTTPStatus.UNSUPPORTED_MEDIA_TYPE, "配置文件不是 UTF-8，网页里改不了")
            else:
                # 还没有文件时先给一份由当前价生成的，保存后就是正式配置。
                text = render(config.book)
            return {
                "path": str(path),
                "text": text,
                "size": len(text.encode("utf-8")),
                "writable": self.allow_write or netutil.is_loopback_address(self.client_address[0]),
            }

        def _config_save(self, body):
            self._require_local()
            text = body.get("text")
            if not isinstance(text, str):
                raise ApiError(HTTPStatus.BAD_REQUEST, "配置内容要是文本")
            # 先按加载时的规则验一遍，写坏的配置会让下一次读取失败、推送也跟着停。
            try:
                validate_text(text)
            except ConfigError as exc:
                raise ApiError(HTTPStatus.BAD_REQUEST, str(exc))
            path = self._config_path()
            try:
                fileio.atomic_write_text(path, text)
            except OSError as exc:
                raise ApiError(HTTPStatus.FORBIDDEN, f"写不了配置文件：{exc}")
            return {"path": str(path), "size": len(text.encode("utf-8"))}

        def _is_local(self):
            return self.allow_write or netutil.is_loopback_address(self.client_address[0])

        def _require_local(self, what: str = "写操作"):
            """写操作与可能带密钥的读都只认本机；--allow-write 放开给其他机器。"""
            if self._is_local():
                return
            raise ApiError(
                HTTPStatus.FORBIDDEN,
                f"{what}只允许本机发起；要放开给其他机器，用 --allow-write 启动",
            )

        def _stream_routes(self, route, query):
            if route == "metrics/stream":
                self._sse([(self.metrics_stream, "metrics")])
                return True
            if route != "usage/stream":
                return False
            self._stream_usage(config, query)
            return True

        def _static(self, path: str, head: bool = False) -> None:
            # 只发打包目录里的文件；路径先解开再核对前缀，防止 ../ 跑出目录。
            name = _static_file(path)
            try:
                body = b"" if head else (name.read_bytes() if name is not None else INDEX.read_bytes())
            except OSError:
                self._error(HTTPStatus.INTERNAL_SERVER_ERROR, "缺少 static/index.html，没有打包前端")
                return
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", _content_type(name if name is not None else INDEX))
            self.send_header("Content-Length", str(len(body)))
            # 产物文件名不带哈希，全部走协商缓存，重新打包后立刻生效。
            self.send_header("Cache-Control", "no-cache")
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
            last = sse_data(payload, event="usage", json_default=str)
            last_write = time.time()
            try:
                self.wfile.write(last.encode("utf-8"))
                self.wfile.flush()
                while True:
                    time.sleep(every)
                    try:
                        with LOCK:
                            payload = _payload(config, query)
                    except Exception as exc:  # noqa: BLE001 - 单轮失败不掐断流
                        self._sse_send({"error": f"{type(exc).__name__}: {exc}"}, "failure")
                        last_write = time.time()
                        continue
                    # 数字没变就只留一条注释，页面不用为同一份数据重排表格、重画图。
                    text = sse_data(payload, event="usage", json_default=str)
                    if text != last:
                        self.wfile.write(text.encode("utf-8"))
                        self.wfile.flush()
                        last = text
                        last_write = time.time()
                    elif time.time() - last_write >= SSE_PING_SECONDS:
                        self.wfile.write(b": ping\n\n")
                        self.wfile.flush()
                        last_write = time.time()
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

    Handler.allow_write = allow_write
    _start_metrics()
    return Handler


def parse_host(text: str) -> str:
    try:
        return netutil.parse_host(text)
    except ValueError as exc:
        raise cli.UsageError(str(exc)) from exc


def is_loopback(host: str) -> bool:
    return netutil.is_loopback_host(host)


def serve(
    config: Config,
    host: str = "0.0.0.0",
    port: int = 8000,
    open_browser: bool = False,
    as_json: bool = False,
    allow_write: bool = False,
) -> int:
    """起网页界面，一直服务到 Ctrl+C。"""
    if not (0 <= port <= 65535):
        print("llmx: --port 取 0 到 65535", file=sys.stderr)
        return 2

    def on_ready(url: str, actual_port: int) -> None:
        local = netutil.host_url("127.0.0.1", actual_port)
        if as_json:
            print(
                json.dumps(
                    {"url": url, "local": local, "host": host, "port": actual_port},
                    ensure_ascii=False,
                )
            )
        else:
            print(f"llmx 网页界面：{url}")
            if url != local:
                print(f"本机 {local}")
            if not is_loopback(host):
                print(
                    "页面没有登录，同一网络里能连上的人都能看用量；只想本机看就加 --host 127.0.0.1",
                    file=sys.stderr,
                )
                if not allow_write:
                    print(
                        "配置读写与会话清理只认本机；要放开给其他机器，加 --allow-write",
                        file=sys.stderr,
                    )
            print("按 Ctrl+C 退出。", file=sys.stderr)
        sys.stdout.flush()

    # 配置档跟着实际 settings.json 走：后台只同步当前激活的那一份。
    profiles.start_sync(config.paths)

    return serve_web(
        _make_handler(config, allow_write=allow_write),
        host,
        port,
        on_ready=on_ready,
        open_browser=open_browser,
        label="llmx",
    )
