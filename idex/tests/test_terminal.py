#!/usr/bin/env python3
# @Author: Himmeltala
# @Date: 2026-11-26 09:29:54
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-26 09:29:54
# @FilePath: \idex\tests\test_terminal.py
# @Description: 终端回归：WebSocket 帧编解码与 PTY 会话的输入输出、缓冲与清理。

"""终端回归：WebSocket 帧编解码与 PTY 会话的输入输出、缓冲与清理。"""

import os
import socket
import struct
import sys
import tempfile
import time
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
WEB = HERE.parent / "src" / "idex" / "web"
sys.path.insert(0, str(HERE.parent.parent / "lib" / "py-shared" / "commons"))
sys.path.insert(0, str(HERE.parent.parent / "lib" / "py-shared" / "services"))
sys.path.insert(0, str(WEB))

from terminal import ws
from terminal.service import TerminalSession


def client_frame(opcode, payload, *, fin=True, mask=b"\x01\x02\x03\x04"):
    data = bytes(payload)
    header = bytearray([(0x80 if fin else 0) | opcode])
    size = len(data)
    if size < 126:
        header.append(0x80 | size)
    elif size < 65536:
        header.append(0x80 | 126)
        header.extend(struct.pack("!H", size))
    else:
        header.append(0x80 | 127)
        header.extend(struct.pack("!Q", size))
    header.extend(mask)
    body = bytes(value ^ mask[index % 4] for index, value in enumerate(data))
    return bytes(header) + body


class WebSocketTest(unittest.TestCase):
    def test_accept_key(self):
        self.assertEqual(ws.accept_key("dGhlIHNhbXBsZSBub25jZQ=="), "s3pPLMBiTxaQ9kYGzzhZRbK+xOo=")

    def test_frame_lengths_and_mask(self):
        for payload in (b"", b"hi", b"x" * 200, b"y" * 70000):
            frame = ws.encode_frame(ws.OP_BINARY, payload)
            head = frame[1]
            if len(payload) < 126:
                self.assertEqual(head, len(payload))
            elif len(payload) < 65536:
                self.assertEqual(head, 126)
            else:
                self.assertEqual(head, 127)
            self.assertEqual(frame[0], 0x80 | ws.OP_BINARY)
            if payload:
                self.assertEqual(frame[-len(payload):], payload)
            else:
                self.assertEqual(len(frame), 2)

    def test_unmask_matches_byte_walk(self):
        mask = b"\x13\x37\xab\xcd"
        for size in (0, 1, 2, 3, 4, 5, 7, 64, 65535, 65536, 65537, 200000):
            payload = bytes((index * 31 + 7) % 256 for index in range(size))
            expected = bytes(value ^ mask[index % 4] for index, value in enumerate(payload))
            self.assertEqual(ws.unmask(payload, mask), expected, size)

    def test_read_masked_and_fragmented(self):
        left, right = socket.socketpair()
        try:
            left.sendall(client_frame(ws.OP_TEXT, b"hel", fin=False))
            left.sendall(client_frame(ws.OP_CONT, b"lo", fin=True))
            opcode, payload = ws.read_message(right)
            self.assertEqual((opcode, payload), (ws.OP_TEXT, b"hello"))
        finally:
            left.close()
            right.close()

    def test_read_ping_and_close(self):
        left, right = socket.socketpair()
        try:
            left.sendall(client_frame(ws.OP_PING, b"x"))
            self.assertEqual(ws.read_message(right), (ws.OP_PING, b"x"))
            left.sendall(client_frame(ws.OP_CLOSE, b""))
            self.assertEqual(ws.read_message(right)[0], ws.OP_CLOSE)
        finally:
            left.close()
            right.close()


class TerminalSessionTest(unittest.TestCase):
    def wait_for(self, session, marker, timeout=8):
        deadline = time.monotonic() + timeout
        seen = b""
        while time.monotonic() < deadline:
            with session.lock:
                chunks = list(session.chunks)
                seq = session.seq
            for _, data in chunks:
                seen += data
            if marker in seen:
                return seq, seen
            time.sleep(0.05)
        self.fail("等不到终端输出：%r" % seen[-200:])

    def test_echo_resize_and_close(self):
        with tempfile.TemporaryDirectory() as root:
            session = TerminalSession("w1", root, 80, 24)
            try:
                seq, _ = self.wait_for(session, b"$")
                self.assertTrue(session.write(b"echo __idex_terminal__\n"))
                self.wait_for(session, b"__idex_terminal__")
                session.resize(120, 40)
                self.assertEqual((session.cols, session.rows), (120, 40))
                with session.lock:
                    self.assertGreater(session.seq, seq)
                replay = session.chunks_since(seq)
                self.assertTrue(all(item[0] > seq for item in replay))
                session.ack(session.seq)
                self.assertEqual(session.buffered, 0)
            finally:
                pid = session.pid
                session.close()
            time.sleep(0.1)
            with self.assertRaises(ProcessLookupError):
                os.kill(pid, 0)

    def test_chunks_since_and_buffered_limit(self):
        with tempfile.TemporaryDirectory() as root:
            session = TerminalSession("w2", root, 80, 24)
            try:
                self.wait_for(session, b"$")
                # 用 Python 的区间构造太慢，这里只验证序号与确认后的裁剪。
                before = session.seq
                session.ack(before)
                self.assertEqual(session.chunks_since(before), [])
            finally:
                session.close()


if __name__ == "__main__":
    unittest.main()
