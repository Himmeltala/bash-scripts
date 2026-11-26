# @Author: Himmeltala
# @Date: 2026-11-26 09:29:54
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-26 09:29:54
# @FilePath: \idex\src\idex\web\lsp\tsserver.py
# @Description: Vue 用的 tsserver 桥：输入一行 JSON，输出 Content-Length 帧。

"""Vue 用的 tsserver 桥：输入一行 JSON，输出 Content-Length 帧。"""

import json
import os
import queue
import signal
import subprocess
import threading

from .protocol import LspError, LspUnavailable, read_message, uri_to_path
from .servers import STABLE_BIN


class TsserverBridge:
    """给 @vue/language-server 用的 tsserver：它反向问的 _vue:* 命令由带 Vue 插件的 tsserver 回答。

    输入一行一条 JSON；tsserver 的输出是 Content-Length 帧，读法同 LSP。
    """

    def __init__(self, command, root, name="tsserver"):
        self.name = name
        self.command = list(command)
        self.root = os.path.abspath(root)
        self.pending = {}
        self.next_id = 0
        self.opened = set()
        self.diagnostics = {}
        self.diag_lock = threading.Lock()
        self.lock = threading.Lock()
        self.write_lock = threading.Lock()
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
            raise LspUnavailable("起不了 tsserver：%s" % exc)
        threading.Thread(target=self._read_loop, daemon=True).start()
        threading.Thread(target=self._read_err, daemon=True).start()
        try:
            self.request("configure", {})
        except LspError:
            self.stop()
            raise

    def _read_loop(self):
        while True:
            message = read_message(self.proc.stdout)
            if message is None:
                break
            if message.get("type") == "event":
                kind = message.get("event")
                body = message.get("body") or {}
                if kind in ("syntaxDiag", "semanticDiag", "suggestionDiag") and body.get("file"):
                    items = []
                    for item in body.get("diagnostics") or []:
                        if not isinstance(item, dict):
                            continue
                        start = item.get("start") or {}
                        try:
                            line = int(start.get("line", 1)) - 1
                            character = int(start.get("offset", 1)) - 1
                        except (TypeError, ValueError):
                            continue
                        category = str(item.get("category") or "error")
                        level = "error" if category == "error" else "warning" if category == "warning" else "info"
                        message = str(item.get("text") or "").strip()
                        if not message:
                            continue
                        items.append(
                            {
                                "severity": level,
                                "line": max(0, line),
                                "character": max(0, character),
                                "message": message[:500],
                                "source": "",
                            }
                        )
                    with self.diag_lock:
                        self.diagnostics[body["file"]] = items[:200]
                continue
            if message.get("type") != "response":
                continue
            with self.lock:
                slot = self.pending.pop(message.get("request_seq"), None)
            if slot is not None:
                slot.put(message)
        with self.lock:
            slots = list(self.pending.values())
            self.pending.clear()
        for slot in slots:
            slot.put({"success": False, "message": "tsserver 退出了"})

    def _read_err(self):
        for _ in iter(self.proc.stderr.readline, b""):
            pass

    def _send(self, payload):
        try:
            with self.write_lock:
                line = json.dumps(payload, ensure_ascii=False) + "\n"
                self.proc.stdin.write(line.encode("utf-8"))
                self.proc.stdin.flush()
        except (BrokenPipeError, ValueError, OSError) as exc:
            raise LspError("tsserver 已经退出：%s" % exc)

    def request(self, command, arguments, timeout=15.0):
        with self.lock:
            self.next_id += 1
            seq = self.next_id
            slot = queue.Queue()
            self.pending[seq] = slot
        self._send({"seq": seq, "type": "request", "command": command, "arguments": arguments})
        try:
            message = slot.get(timeout=timeout)
        except queue.Empty:
            with self.lock:
                self.pending.pop(seq, None)
            raise LspError("tsserver 超过 %d 秒没回话" % timeout)
        if not message.get("success", False):
            raise LspError(str(message.get("message") or "tsserver 报错"))
        return message.get("body")

    def _paths(self, value):
        if isinstance(value, str):
            if value.startswith("file://"):
                path = uri_to_path(value)
                if path and os.path.isfile(path):
                    yield path
            elif os.path.isabs(value) and os.path.isfile(value):
                yield value
        elif isinstance(value, dict):
            for item in value.values():
                yield from self._paths(item)
        elif isinstance(value, (list, tuple)):
            for item in value:
                yield from self._paths(item)

    def _open_paths(self, arguments):
        # tsserver 要先 open 过文件，_vue:* 这些自定义命令才认得那个项目。
        for path in self._paths(arguments):
            if path in self.opened:
                continue
            self.opened.add(path)
            try:
                self.request("open", {"file": path})
            except LspError:
                self.opened.discard(path)

    def open(self, path):
        if path in self.opened:
            return
        self.opened.add(path)
        try:
            self.request("open", {"file": path})
        except LspError:
            self.opened.discard(path)
            raise

    def snapshot(self, path):
        with self.diag_lock:
            return list(self.diagnostics.get(path) or [])

    def forward(self, name, arguments):
        if self.proc.poll() is not None:
            raise LspError("tsserver 已经退出")
        self._open_paths(arguments)
        return self.request(name, arguments)

    def stop(self):
        try:
            self._send({"seq": 0, "type": "request", "command": "exit", "arguments": {}})
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

