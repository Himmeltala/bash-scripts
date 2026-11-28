# @Author: Himmeltala
# @Date: 2026-11-26 09:29:54
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-26 09:29:54
# @FilePath: \idex\src\idex\web\terminal\routes.py
# @Description: 终端的 HTTP 与 WebSocket 入口：会话管理、输入输出、重放与心跳。

import json
import queue
import socket
import struct
import threading
import time
from urllib.parse import parse_qs, urlparse

from web import ApiError

from . import ws
from .service import BATCH_LIMIT


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
        # 按键回显大多是小帧，Nagle 会拖到几十毫秒才发。
        try:
            self.connection.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        except OSError:
            pass
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

    def _send_lock(self):
        lock = getattr(self, "_terminal_send_lock", None)
        if lock is None:
            lock = self._terminal_send_lock = threading.Lock()
        return lock

    def _terminal_send(self, opcode, payload):
        with self._send_lock():
            self.connection.sendall(ws.encode_frame(opcode, payload))

    # 大块输出分两次发：帧头加序号很小，数据块不再复制一遍。
    def _terminal_send_chunk(self, seq, payload):
        head = struct.pack("!I", seq)
        frame = ws.frame_header(ws.OP_BINARY, len(head) + len(payload))
        with self._send_lock():
            self.connection.sendall(frame + head)
            self.connection.sendall(payload)

    # 会话结束时把队列里还没发的块补发完，别把重放期间的最后一屏丢掉。
    def _drain_queue(self, box, sent):
        parts = []
        size = 0
        while True:
            try:
                item = box.get_nowait()
            except queue.Empty:
                break
            if item is None:
                break
            seq, data = item
            if seq <= sent:
                continue
            parts.append(data)
            size += len(data)
            sent = seq
            if size >= BATCH_LIMIT:
                try:
                    self._terminal_send_chunk(sent, b"".join(parts))
                except OSError:
                    return sent
                parts = []
                size = 0
        if parts:
            try:
                self._terminal_send_chunk(sent, b"".join(parts))
            except OSError:
                pass
        return sent

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
        # 先订阅再重放：中间新产生的输出落到队列里，不会漏在快照之外；
        # 重复的块按序号丢弃。
        box = session.subscribe()
        sent = max(0, since)
        stop = threading.Event()
        try:
            # 重放同样合批：一帧带多个块，序号取最后一块。
            parts = []
            size = 0
            try:
                for seq, data in session.chunks_since(sent):
                    parts.append(data)
                    size += len(data)
                    sent = seq
                    if size >= BATCH_LIMIT:
                        self._terminal_send_chunk(sent, b"".join(parts))
                        parts = []
                        size = 0
                if parts:
                    self._terminal_send_chunk(sent, b"".join(parts))
            except OSError:
                return
            if session.done:
                # 重放期间新产生的块还压在队列里，先发完再报退出。
                sent = self._drain_queue(box, sent)
                try:
                    self._terminal_send(ws.OP_TEXT, json.dumps({"type": "exit", "seq": sent}))
                except OSError:
                    pass
                return

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
                            try:
                                session.resize(
                                    message.get("cols") or 100, message.get("rows") or 30
                                )
                            except (TypeError, ValueError):
                                continue
                        elif kind == "ack":
                            try:
                                session.ack(int(message.get("seq") or 0))
                            except (TypeError, ValueError):
                                pass
                stop.set()

            reader = threading.Thread(target=read_loop, name="idex-term-read", daemon=True)
            reader.start()
            last_ping = time.monotonic()
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
                # 队列里已经堆着的先并进同一帧，帧头序号用最后一条；
                # 客户端确认这个序号，服务端就能把前面的块一起回收。
                payload = [data]
                size = len(data)
                exiting = False
                while size < BATCH_LIMIT:
                    try:
                        more = box.get_nowait()
                    except queue.Empty:
                        break
                    if more is None:
                        exiting = True
                        break
                    next_seq, next_data = more
                    if next_seq <= seq:
                        continue
                    seq = next_seq
                    payload.append(next_data)
                    size += len(next_data)
                try:
                    self._terminal_send_chunk(seq, b"".join(payload))
                except OSError:
                    break
                sent = seq
                if exiting:
                    try:
                        self._terminal_send(
                            ws.OP_TEXT, json.dumps({"type": "exit", "seq": sent})
                        )
                    except OSError:
                        pass
                    break
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
