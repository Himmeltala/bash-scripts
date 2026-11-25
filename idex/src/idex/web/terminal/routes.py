"""终端的 HTTP 与 WebSocket 入口：会话管理、输入输出、重放与心跳。"""

import json
import queue
import struct
import threading
import time
from urllib.parse import parse_qs, urlparse

from web import ApiError

from . import ws


class TerminalRoutes:
    """终端接口的实现，靠 MRO 混进 Handler。"""

    terminals = None

    def do_GET(self):
        url = urlparse(self.path)
        if url.path.rstrip("/") == self.api_prefix.rstrip("/") + "/terminal/ws":
            self._terminal_ws(url)
            return
        super().do_GET()

    def _terminal_manager(self):
        if self.terminals is None:
            raise ApiError(503, "终端服务没有起来")
        return self.terminals

    def _terminal_ws(self, url):
        query = parse_qs(url.query)
        if self.headers.get("Upgrade", "").lower() != "websocket":
            self._json(400, {"error": "终端接口只接受 WebSocket"})
            return
        origin = self.headers.get("Origin")
        if origin and urlparse(origin).netloc != self.headers.get("Host", ""):
            self._json(403, {"error": "拒绝跨站终端连接"})
            return
        try:
            self._check_write()
        except ApiError as exc:
            self._json(exc.status, {"error": exc.message})
            return
        key = self.headers.get("Sec-WebSocket-Key")
        if not key:
            self._json(400, {"error": "缺少 WebSocket key"})
            return
        ws_id = (query.get("ws") or [""])[0]
        workspace = self.store.find(ws_id)
        if workspace is None:
            self._json(404, {"error": "没有这个工作区"})
            return
        session_id = (query.get("session") or [""])[0]
        session = self._terminal_manager().get(session_id) if session_id else None
        if session_id and session is None:
            self._json(404, {"error": "终端会话不在了"})
            return
        if session is not None and session.ws_id != workspace["id"]:
            self._json(403, {"error": "这个终端不属于当前工作区"})
            return

        self.send_response(101, "Switching Protocols")
        self.send_header("Upgrade", "websocket")
        self.send_header("Connection", "Upgrade")
        self.send_header("Sec-WebSocket-Accept", ws.accept_key(key))
        self.end_headers()
        self.close_connection = True

        if session is None:
            cols = int((query.get("cols") or ["100"])[0] or 100)
            rows = int((query.get("rows") or ["30"])[0] or 30)
            try:
                session = self._terminal_manager().create(workspace["id"], workspace["root"], cols, rows)
            except ValueError as exc:
                self._terminal_send(ws.OP_TEXT, json.dumps({"type": "error", "error": str(exc)}))
                return
        try:
            since = int((query.get("since") or ["0"])[0])
        except ValueError:
            since = 0
        self._terminal_run(session, since)

    def _terminal_send(self, opcode, payload):
        with getattr(self, "_terminal_send_lock", threading.Lock()):
            self.connection.sendall(ws.encode_frame(opcode, payload))

    def _terminal_run(self, session, since):
        send_lock = threading.Lock()
        self._terminal_send_lock = send_lock
        self._terminal_send(
            ws.OP_TEXT,
            json.dumps(
                {
                    "type": "ready",
                    "id": session.id,
                    "title": session.shell,
                    "cols": session.cols,
                    "rows": session.rows,
                }
            ),
        )
        sent = max(0, since)
        for seq, data in session.chunks_since(sent):
            self._terminal_send(ws.OP_BINARY, struct.pack("!I", seq) + data)
            sent = seq
        if session.done:
            self._terminal_send(ws.OP_TEXT, json.dumps({"type": "exit", "seq": sent}))
            return

        box = session.subscribe()
        stop = threading.Event()

        def read_loop():
            while not stop.is_set():
                try:
                    opcode, payload = ws.read_message(self.connection)
                except (OSError, ValueError):
                    break
                if opcode is None or opcode == ws.OP_CLOSE:
                    break
                if opcode == ws.OP_PING:
                    try:
                        self._terminal_send(ws.OP_PONG, payload)
                    except OSError:
                        break
                elif opcode == ws.OP_BINARY:
                    if not session.write(payload):
                        break
                elif opcode == ws.OP_TEXT:
                    try:
                        message = json.loads(payload.decode("utf-8", "replace"))
                    except ValueError:
                        continue
                    if not isinstance(message, dict):
                        continue
                    kind = message.get("type")
                    if kind == "resize":
                        session.resize(message.get("cols") or 100, message.get("rows") or 30)
                    elif kind == "ack":
                        try:
                            session.ack(int(message.get("seq") or 0))
                        except (TypeError, ValueError):
                            pass
            stop.set()

        reader = threading.Thread(target=read_loop, name="idex-term-read", daemon=True)
        reader.start()
        last_ping = time.monotonic()
        try:
            while not stop.is_set():
                try:
                    item = box.get(timeout=1)
                except queue.Empty:
                    if time.monotonic() - last_ping > 20:
                        try:
                            self._terminal_send(ws.OP_PING, b"")
                        except OSError:
                            break
                        last_ping = time.monotonic()
                    continue
                if item is None:
                    try:
                        self._terminal_send(
                            ws.OP_TEXT, json.dumps({"type": "exit", "seq": sent})
                        )
                    except OSError:
                        pass
                    break
                seq, data = item
                if seq <= sent:
                    continue
                try:
                    self._terminal_send(ws.OP_BINARY, struct.pack("!I", seq) + data)
                except OSError:
                    break
                sent = seq
        finally:
            stop.set()
            session.unsubscribe(box)
            try:
                self.connection.shutdown(2)
            except OSError:
                pass

    def _terminal_sessions(self, query):
        ws_id = (query.get("ws") or [""])[0]
        workspace = self.store.find(ws_id)
        if workspace is None:
            raise ApiError(404, "没有这个工作区")
        return {"sessions": self._terminal_manager().list(workspace["id"])}

    def _terminal_close(self, body):
        self._check_write()
        workspace = self.store.find(str(body.get("ws") or ""))
        if workspace is None:
            raise ApiError(404, "没有这个工作区")
        session = self._terminal_manager().get(str(body.get("id") or ""))
        if session is None:
            return {"ok": True}
        if session.ws_id != workspace["id"]:
            raise ApiError(403, "这个终端不属于当前工作区")
        self._terminal_manager().close(session.id)
        return {"ok": True}
