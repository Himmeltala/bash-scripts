"""一条语言服务器子进程会话：拉起、初始化、打开文档、发请求、收诊断。"""

import json
import os
import queue
import signal
import subprocess
import threading
import time

from lsp_protocol import (
    LspError,
    LspUnavailable,
    encode_message,
    normalize_diagnostics,
    path_to_uri,
    read_message,
)
from lsp_servers import STABLE_BIN


class LspServer:
    """一条 LSP 会话。请求串行由调用方保证，这里只管协议。"""

    def __init__(
        self,
        command,
        root,
        name,
        init_timeout=30.0,
        request_timeout=10.0,
        options=None,
    ):
        self.name = name
        self.root = os.path.abspath(root)
        self.command = list(command)
        self.init_timeout = init_timeout
        self.request_timeout = request_timeout
        self.options = options or {}
        self.pending = {}
        self.next_id = 0
        self.lock = threading.Lock()
        self.write_lock = threading.Lock()
        self.doc_lock = threading.Lock()
        self.versions = {}
        self.texts = {}
        self.diagnostics = {}
        self.diag_lock = threading.Lock()
        self.stderr_tail = []
        env = os.environ.copy()
        extra = [path for path in STABLE_BIN if os.path.isdir(path)]
        env["PATH"] = os.pathsep.join(extra + [env.get("PATH", "")])
        try:
            self.proc = subprocess.Popen(
                self.command,
                cwd=self.root,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                start_new_session=True,
                env=env,
            )
        except OSError as exc:
            raise LspUnavailable("起不了 %s 语言服务器：%s" % (name, exc))
        threading.Thread(target=self._read_loop, daemon=True).start()
        threading.Thread(target=self._read_err, daemon=True).start()
        try:
            self._initialize()
        except LspError:
            self.stop()
            raise

    def _read_loop(self):
        stream = self.proc.stdout
        while True:
            message = read_message(stream)
            if message is None:
                break
            if message.get("method") == "textDocument/publishDiagnostics":
                params = message.get("params") or {}
                uri = str(params.get("uri") or "")
                if uri:
                    with self.diag_lock:
                        self.diagnostics[uri] = normalize_diagnostics(params.get("diagnostics") or [])
                continue
            if "id" in message and ("result" in message or "error" in message):
                with self.lock:
                    slot = self.pending.pop(message["id"], None)
                if slot is not None:
                    slot.put(message)
                continue
            if "id" in message and "method" in message:
                self._answer(message)
        with self.lock:
            slots = list(self.pending.values())
            self.pending.clear()
        for slot in slots:
            slot.put({"error": {"message": "语言服务器退出了"}})

    def _read_err(self):
        for raw in iter(self.proc.stderr.readline, b""):
            text = raw.decode("utf-8", "replace").rstrip()
            if not text:
                continue
            self.stderr_tail.append(text)
            del self.stderr_tail[:-40]

    def _answer(self, message):
        """服务器反向发过来的请求：能回的都回，免得它等在那儿不动。"""
        method = message.get("method")
        params = message.get("params") or {}
        result = None
        if method == "workspace/configuration":
            result = [None] * len(params.get("items") or [])
        elif method == "workspace/applyEdit":
            result = {"applied": False}
        self._send({"jsonrpc": "2.0", "id": message["id"], "result": result})

    def _send(self, payload):
        try:
            with self.write_lock:
                self.proc.stdin.write(encode_message(payload))
                self.proc.stdin.flush()
        except (BrokenPipeError, ValueError, OSError) as exc:
            raise LspError("语言服务器 %s 已经退出：%s" % (self.name, exc))

    def request(self, method, params, timeout=None):
        with self.lock:
            self.next_id += 1
            rid = self.next_id
            slot = queue.Queue()
            self.pending[rid] = slot
        self._send({"jsonrpc": "2.0", "id": rid, "method": method, "params": params})
        wait = self.request_timeout if timeout is None else timeout
        try:
            message = slot.get(timeout=wait)
        except queue.Empty:
            with self.lock:
                self.pending.pop(rid, None)
            raise LspError("语言服务器 %s 超过 %d 秒没回话" % (self.name, wait))
        if "error" in message and message["error"]:
            text = message["error"].get("message") if isinstance(message["error"], dict) else message["error"]
            raise LspError(str(text or "语言服务器报错"))
        return message.get("result")

    def notify(self, method, params):
        self._send({"jsonrpc": "2.0", "method": method, "params": params})

    def _initialize(self):
        root_uri = path_to_uri(self.root)
        params = {
            "processId": os.getpid(),
            "rootPath": self.root,
            "rootUri": root_uri,
            "capabilities": {
                "textDocument": {
                    "synchronization": {"dynamicRegistration": False, "didSave": False},
                    "definition": {"dynamicRegistration": False, "linkSupport": True},
                },
                "workspace": {"configuration": True, "workspaceFolders": True},
            },
            "workspaceFolders": [{"uri": root_uri, "name": os.path.basename(self.root)}],
        }
        if self.options:
            params["initializationOptions"] = self.options
        self.request("initialize", params, timeout=self.init_timeout)
        self.notify("initialized", {})

    def sync(self, path, text, language):
        """把浏览器里这份文本交给服务器：第一次 didOpen，之后有变化发 didChange。"""
        uri = path_to_uri(path)
        with self.doc_lock:
            version = self.versions.get(uri)
            if version is None:
                self.versions[uri] = 1
                self.texts[uri] = text
                self.notify(
                    "textDocument/didOpen",
                    {
                        "textDocument": {
                            "uri": uri,
                            "languageId": language,
                            "version": 1,
                            "text": text,
                        }
                    },
                )
                return
            if self.texts.get(uri) == text:
                return
            version += 1
            self.versions[uri] = version
            self.texts[uri] = text
            self.notify(
                "textDocument/didChange",
                {
                    "textDocument": {"uri": uri, "version": version},
                    "contentChanges": [{"text": text}],
                },
            )

    def query(self, method, path, text, language, line, character, extra=None):
        self.sync(path, text, language)
        params = {
            "textDocument": {"uri": path_to_uri(path)},
            "position": {"line": line, "character": character},
        }
        if extra:
            params.update(extra)
        return self.request(method, params, timeout=self.request_timeout)

    def definition(self, path, text, language, line, character):
        return self.query(
            "textDocument/definition", path, text, language, line, character
        )

    def snapshot(self, uri):
        with self.diag_lock:
            return list(self.diagnostics.get(uri) or [])

    def hover(self, path, text, language, line, character):
        self.sync(path, text, language)
        return self.request(
            "textDocument/hover",
            {
                "textDocument": {"uri": path_to_uri(path)},
                "position": {"line": line, "character": character},
            },
            timeout=self.request_timeout,
        )

    def documentsymbol(self, path, text, language):
        self.sync(path, text, language)
        return self.request(
            "textDocument/documentSymbol",
            {"textDocument": {"uri": path_to_uri(path)}},
            timeout=self.request_timeout,
        )

    def rename(self, path, text, language, line, character, new_name):
        self.sync(path, text, language)
        return self.request(
            "textDocument/rename",
            {
                "textDocument": {"uri": path_to_uri(path)},
                "position": {"line": line, "character": character},
                "newName": new_name,
            },
            timeout=self.request_timeout,
        )

    def stop(self):
        try:
            self.request("shutdown", None, timeout=3)
        except LspError:
            pass
        try:
            self.notify("exit", None)
        except LspError:
            pass
        try:
            self.proc.stdin.close()
        except (OSError, ValueError):
            pass
        try:
            self.proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            try:
                os.killpg(os.getpgid(self.proc.pid), signal.SIGTERM)
            except OSError:
                pass
            try:
                self.proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                try:
                    os.killpg(os.getpgid(self.proc.pid), signal.SIGKILL)
                except OSError:
                    pass
        for stream in (self.proc.stdout, self.proc.stderr):
            try:
                stream.close()
            except (OSError, ValueError):
                pass


def stop_instance(item):
    if item.server is not None:
        item.server.stop()
    if item.bridge is not None:
        item.bridge.stop()


class _Instance:
    def __init__(self, ws, key, server, bridge=None):
        self.ws = ws
        self.key = key
        self.server = server
        self.bridge = bridge
        self.last_used = time.time()
        self.lock = threading.Lock()

