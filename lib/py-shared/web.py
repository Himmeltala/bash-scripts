"""网页进程的公共骨架：请求路由、JSON 回话、静态页面、监听地址。

三个工具的 ``server.py`` 各自继承 ``WebHandler``，只实现 ``_dispatch``；
需要先接下的流式接口覆写 ``_stream_routes``。
"""

import json
import os
import shutil
import socket
import sys
import tempfile
import zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, urlparse


class ApiError(Exception):
    def __init__(self, status, message):
        Exception.__init__(self, message)
        self.status = status
        self.message = message


# _dispatch 用它表示「回话已经流式写完」，外层别再包 JSON。
STREAMED = object()


def log(msg):
    print(msg, file=sys.stderr, flush=True)


def is_any(host):
    """0.0.0.0 与 :: 都是「所有网卡」，不能拿来当访问地址。"""
    return host in ("0.0.0.0", "::", "")


def guess_host():
    """监听全地址时给浏览器一个能点开的地址：取本机出口 IP，猜不出来就用回环。"""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            sock.connect(("10.255.255.255", 1))
            return sock.getsockname()[0]
        finally:
            sock.close()
    except OSError:
        return "127.0.0.1"


CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".gif": "image/gif",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".eot": "application/vnd.ms-fontobject",
    ".zip": "application/zip",
    ".map": "application/json; charset=utf-8",
}


def zip_dir(src, skip=()):
    """把目录压进临时 zip，返回 (临时路径, 字节数)；子项名字在 skip 里的跳过。"""
    src = Path(src)
    top = src.name or "download"
    handle = tempfile.NamedTemporaryFile(prefix="web-", suffix=".zip", delete=False)
    try:
        with handle, zipfile.ZipFile(handle, "w", zipfile.ZIP_DEFLATED, allowZip64=True) as bundle:
            added = False
            for dirpath, dirnames, filenames in os.walk(src):
                dirnames[:] = sorted(d for d in dirnames if d not in skip)
                for name in sorted(filenames):
                    full = os.path.join(dirpath, name)
                    if os.path.islink(full) or not os.path.isfile(full):
                        continue
                    bundle.write(full, os.path.join(top, os.path.relpath(full, src)))
                    added = True
            if not added:
                bundle.writestr(top + "/", b"")
    except BaseException:
        if os.path.exists(handle.name):
            os.unlink(handle.name)
        raise
    return handle.name, os.path.getsize(handle.name)


class WebServer(ThreadingHTTPServer):
    """客户端提前断开不算错误：关标签或刷新时回话写不出去，不必打整段栈。"""

    def handle_error(self, request, client_address):
        if isinstance(sys.exc_info()[1], (BrokenPipeError, ConnectionResetError, ConnectionAbortedError)):
            return
        ThreadingHTTPServer.handle_error(self, request, client_address)


class WebHandler(BaseHTTPRequestHandler):
    """页面与接口的公共部分；子类给 api_prefix 与 _dispatch。"""

    server_version = "web"
    protocol_version = "HTTP/1.1"

    static = None
    api_prefix = "/__api"

    def log_message(self, fmt, *args):
        # 访问日志默认打到 stderr，轮询一多就长，这里丢掉。
        pass

    def do_GET(self):
        self._route("GET")

    def do_HEAD(self):
        self._route("HEAD")

    def do_POST(self):
        self._route("POST")

    def _route(self, method):
        url = urlparse(self.path)
        if not url.path.startswith(self.api_prefix):
            if method == "POST":
                self._send(405, b"", "text/plain")
                return
            self._static(url.path, head=(method == "HEAD"))
            return
        route = url.path[len(self.api_prefix):].strip("/")
        query = parse_qs(url.query)
        # 流式接口自己写响应头与数据流，不走下面一次性回 JSON 的路。
        if method == "GET":
            try:
                if self._stream_routes(route, query):
                    return
            except ApiError as exc:
                self._json(exc.status, {"error": exc.message})
                return
        try:
            if method == "POST":
                self._check_origin()
            body = self._read_json() if method == "POST" else {}
            result = self._dispatch(method, route, query, body)
        except ApiError as exc:
            self._json(exc.status, {"error": exc.message})
            return
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            return
        except Exception as exc:  # 页面看到一句人话，比连接被断开强
            self._error_log("接口出错 %s %s：%r" % (method, self.path, exc))
            self._json(500, {"error": "服务端出错：%s" % exc})
            return
        # 流式回话已经自己写完，别再套一层 JSON。
        if result is STREAMED:
            return
        self._json(200, result)

    def _stream_routes(self, route, query):
        """GET 里要先接下的流式接口；返回 True 表示已经写完。"""
        return False

    def _dispatch(self, method, route, query, body):
        raise NotImplementedError

    def _error_log(self, msg):
        """接口内部的异常写到哪里；dvcsx 要带时间戳，覆写这一条。"""
        log(msg)

    def _check_origin(self):
        """跨站写请求挡在门外：只认同源的 Origin。没带 Origin 的（脚本、curl）放行。"""
        origin = self.headers.get("Origin")
        if not origin:
            return
        if urlparse(origin).netloc != self.headers.get("Host", ""):
            raise ApiError(403, "拒绝跨站写请求")

    def _read_json(self):
        length = self.headers.get("Content-Length")
        if length is None:
            return {}
        try:
            length = int(length)
        except ValueError:
            raise ApiError(400, "Content-Length 不对")
        raw = self.rfile.read(length) if length > 0 else b""
        if not raw:
            return {}
        try:
            data = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise ApiError(400, "请求体不是 JSON")
        if not isinstance(data, dict):
            raise ApiError(400, "请求体要是一个对象")
        return data

    def _static(self, path, head=False):
        rel = path.lstrip("/") or "index.html"
        target = (self.static / rel).resolve()
        try:
            target.relative_to(self.static)
        except ValueError:
            self._send(404, b"", "text/plain", head=head)
            return
        if target.is_dir():
            target = target / "index.html"
        if not target.is_file():
            # 带点的当作文件，真没有就 404；其余交回首页，前端自己按路径找页面。
            if "." in Path(rel).name or not (self.static / "index.html").is_file():
                self._send(404, b"not found\n", "text/plain", head=head)
                return
            target = self.static / "index.html"
        ctype = CONTENT_TYPES.get(target.suffix.lower(), "application/octet-stream")
        # 带哈希的资源缓存十分钟；首页不缓存，重新打包立刻生效。
        cache = "no-cache" if target.name == "index.html" else "public, max-age=600"
        data = b"" if head else target.read_bytes()
        self._send(200, data, ctype, head=head, cache=cache)

    def _json(self, status, payload):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self._send(status, data, "application/json; charset=utf-8", cache="no-store")

    def _send_download(self, path, name, head=False):
        """按附件下发，文件名用 RFC 5987 编码，中文名也能对。"""
        path = Path(path)
        ctype = CONTENT_TYPES.get(path.suffix.lower(), "application/octet-stream")
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(path.stat().st_size))
        self.send_header("Content-Disposition", "attachment; filename*=UTF-8''%s" % quote(name))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if head:
            return
        with open(path, "rb") as handle:
            shutil.copyfileobj(handle, self.wfile)

    def _send(self, status, data, ctype, head=False, cache=None):
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        if cache:
            self.send_header("Cache-Control", cache)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        if not head:
            self.wfile.write(data)
