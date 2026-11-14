"""测试用的小工具：按路径加载模块、读 SSE、调 JSON 接口、起临时服务。

这里不能 import web、sse、stores：它要能先于这三层被测试自己加载。
"""

import importlib.util
import json
import threading
import time
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path


def load_module(name, path):
    """按文件路径加载一个模块，名字由调用方给，避免和已加载的模块撞车。"""
    spec = importlib.util.spec_from_file_location(name, str(path))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def read_sse_event(resp):
    """从响应里读一条 SSE 事件，返回 (event, data)；data 多行时按换行拼起来。"""
    event = ""
    data = []
    while True:
        line = resp.readline()
        if not line:
            return event, "\n".join(data)
        if isinstance(line, bytes):
            line = line.decode("utf-8", "replace")
        line = line.rstrip("\r\n")
        if not line:
            return event, "\n".join(data)
        if line.startswith(":"):
            continue
        field, sep, value = line.partition(":")
        if not sep:
            continue
        if value.startswith(" "):
            value = value[1:]
        if field == "event":
            event = value
        elif field == "data":
            data.append(value)


def json_call(base_url, path, body=None, timeout=30):
    """调一个 JSON 接口，返回 (状态码, 解析后的回话)；HTTP 错误也照样解析。"""
    data = json.dumps(body).encode("utf-8") if body is not None else None
    headers = {"Content-Type": "application/json"} if data is not None else {}
    url = base_url.rstrip("/") + "/" + path.lstrip("/")
    request = urllib.request.Request(url, data=data, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        try:
            payload = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, ValueError):
            payload = {}
        return exc.code, payload


def poll_until(fn, timeout=10.0, interval=0.1, message=None):
    """反复调 fn 直到它返回真值；超时抛 AssertionError。"""
    deadline = time.time() + timeout
    while True:
        value = fn()
        if value:
            return value
        if time.time() >= deadline:
            raise AssertionError(message or "等不到预期结果")
        time.sleep(interval)


class TestServer:
    """临时 HTTP 服务：后台 daemon 线程跑，退出时 shutdown 并关掉端口。"""

    def __init__(self, handler_cls, static=None, api_prefix=None, host="127.0.0.1", port=0, **attrs):
        if static is not None:
            setattr(handler_cls, "static", Path(static))
        if api_prefix is not None:
            setattr(handler_cls, "api_prefix", api_prefix)
        for name, value in attrs.items():
            setattr(handler_cls, name, value)
        self.handler = handler_cls
        self.api_prefix = api_prefix
        self.httpd = ThreadingHTTPServer((host, port), handler_cls)
        self.httpd.daemon_threads = True
        self._thread = None
        self._closed = False

    def start(self):
        self._thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self._thread.start()
        return self

    @property
    def server_address(self):
        return self.httpd.server_address

    @property
    def port(self):
        return self.httpd.server_address[1]

    @property
    def url(self):
        return "http://127.0.0.1:%d" % self.port

    @property
    def base(self):
        if not self.api_prefix:
            return self.url
        return self.url + "/" + self.api_prefix.strip("/")

    def shutdown(self):
        if self._closed:
            return
        self._closed = True
        self.httpd.shutdown()
        self.httpd.server_close()
        if self._thread is not None:
            self._thread.join(timeout=5)

    def __enter__(self):
        return self.start()

    def __exit__(self, exc_type, exc, tb):
        self.shutdown()
        return False


def serve(handler_cls, static=None, api_prefix=None, **attrs):
    """按给定的 Handler 起一个临时服务，返回已经开始的 TestServer。"""
    return TestServer(handler_cls, static=static, api_prefix=api_prefix, **attrs).start()
