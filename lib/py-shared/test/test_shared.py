#!/usr/bin/env python3
"""共享层第一批小件的回归：fileio、pathutil、netutil、kvstore 与 testkit。"""

import http.client
import json
import os
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

import fileio
import kvstore
import netutil
import pathutil
import runner
import stores
import testkit


class FileIoTest(unittest.TestCase):
    def test_read_json_returns_default_for_broken_file(self):
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "bad.json"
            path.write_text('{"a": ', "utf-8")
            self.assertEqual(fileio.read_json(path, default={"x": 1}), {"x": 1})
            self.assertEqual(fileio.read_json(Path(td) / "missing.json", default=[]), [])

    def test_read_json_round_trip(self):
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "ok.json"
            self.assertTrue(fileio.write_json(path, {"a": "中文"}, indent=None))
            self.assertEqual(fileio.read_json(path), {"a": "中文"})
            # 原子替换后不留下临时文件。
            self.assertFalse((Path(td) / "ok.json.tmp").exists())

    def test_atomic_write_replaces_existing(self):
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "sub" / "a.txt"
            self.assertTrue(fileio.atomic_write_text(path, "old"))
            self.assertTrue(fileio.atomic_write_text(path, "new"))
            self.assertEqual(path.read_text("utf-8"), "new")
            self.assertFalse((path.parent / "a.txt.tmp").exists())

    def test_atomic_write_reports_errors(self):
        with tempfile.TemporaryDirectory() as td:
            seen = []
            path = Path(td) / "dir"
            path.mkdir()
            # 目标是目录，替换会失败，回调接住而不往上抛。
            self.assertFalse(fileio.atomic_write_text(path, "x", on_error=seen.append))
            self.assertTrue(seen)

    def test_write_text_preserves_crlf(self):
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "crlf.txt"
            path.write_bytes(b"a\r\nb\r\n")
            size = fileio.write_text_preserve_newlines(path, "x\ny\n")
            self.assertEqual(path.read_bytes(), b"x\r\ny\r\n")
            self.assertEqual(size, len(b"x\r\ny\r\n"))

    def test_write_text_preserves_lf(self):
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "lf.txt"
            path.write_bytes(b"a\nb\n")
            fileio.write_text_preserve_newlines(path, "x\r\ny\r\n")
            self.assertEqual(path.read_bytes(), b"x\ny\n")

    def test_preview_detects_binary_and_encoding(self):
        with tempfile.TemporaryDirectory() as td:
            binary = Path(td) / "b.bin"
            binary.write_bytes(b"a\x00b")
            with self.assertRaises(fileio.PreviewError) as caught:
                fileio.read_text_preview(binary)
            self.assertEqual(caught.exception.kind, "binary")

            latin = Path(td) / "l.txt"
            latin.write_bytes(b"\xff")
            with self.assertRaises(fileio.PreviewError) as caught:
                fileio.read_text_preview(latin)
            self.assertEqual(caught.exception.kind, "encoding")

            big = Path(td) / "big.txt"
            big.write_bytes(b"12345")
            with self.assertRaises(fileio.PreviewError) as caught:
                fileio.read_text_preview(big, max_bytes=4)
            self.assertEqual(caught.exception.kind, "too_large")
            self.assertEqual(caught.exception.size, 5)
            self.assertEqual(caught.exception.max_bytes, 4)

    def test_preview_returns_utf8_text(self):
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "a.txt"
            path.write_text("你好\n", "utf-8")
            self.assertEqual(fileio.read_text_preview(path), "你好\n")


class PathUtilTest(unittest.TestCase):
    def test_safe_relative_rejects_escape(self):
        for rel in ("", "/etc/passwd", "../x", "a/../b"):
            with self.assertRaises(pathutil.PathError, msg=rel):
                pathutil.safe_relative(rel, "文件路径")
        self.assertEqual(pathutil.safe_relative("a/b.txt", "文件路径"), "a/b.txt")

    def test_within_follows_symlinks(self):
        with tempfile.TemporaryDirectory() as td:
            base = Path(td)
            root = base / "root"
            outside = base / "outside"
            root.mkdir()
            outside.mkdir()
            (root / "a.txt").write_text("a", "utf-8")
            (outside / "secret.txt").write_text("s", "utf-8")
            self.assertTrue(pathutil.within(root / "a.txt", root))
            self.assertTrue(pathutil.within(root / ".." / "root" / "a.txt", root))
            os.symlink(str(outside), str(root / "link"))
            self.assertFalse(pathutil.within(root / "link" / "secret.txt", root))
            self.assertFalse(pathutil.within(outside / "secret.txt", root))

    def test_static_target(self):
        with tempfile.TemporaryDirectory() as td:
            static = Path(td) / "static"
            (static / "sub").mkdir(parents=True)
            (static / "index.html").write_text("index", "utf-8")
            (static / "sub" / "index.html").write_text("sub", "utf-8")
            root = static.resolve()
            self.assertEqual(pathutil.static_target(static, "/"), root / "index.html")
            self.assertEqual(pathutil.static_target(static, "/sub"), root / "sub" / "index.html")
            self.assertIsNone(pathutil.static_target(static, "/../x"))
            outside = Path(td) / "outside"
            outside.mkdir()
            (outside / "x.txt").write_text("x", "utf-8")
            os.symlink(str(outside), str(static / "link"))
            self.assertIsNone(pathutil.static_target(static, "/link/x.txt"))


class NetUtilTest(unittest.TestCase):
    def test_loopback_addresses(self):
        self.assertTrue(netutil.is_loopback_address("127.0.0.1"))
        self.assertTrue(netutil.is_loopback_address("::1"))
        self.assertTrue(netutil.is_loopback_address("::ffff:127.0.0.1"))
        self.assertFalse(netutil.is_loopback_address("192.168.1.20"))
        self.assertFalse(netutil.is_loopback_address("::ffff:192.168.1.20"))
        self.assertFalse(netutil.is_loopback_address("not-an-ip"))

    def test_loopback_hosts(self):
        self.assertTrue(netutil.is_loopback_host("localhost"))
        self.assertTrue(netutil.is_loopback_host("127.0.0.1"))
        self.assertFalse(netutil.is_loopback_host("192.168.1.20"))
        self.assertFalse(netutil.is_loopback_host("localhost.example"))

    def test_parse_host(self):
        self.assertEqual(netutil.parse_host("localhost"), "localhost")
        self.assertEqual(netutil.parse_host("::1"), "::1")
        with self.assertRaises(ValueError) as caught:
            netutil.parse_host("example.com")
        self.assertIn("--host example.com", str(caught.exception))

    def test_any_host_and_url(self):
        self.assertTrue(netutil.is_any_host("0.0.0.0"))
        self.assertTrue(netutil.is_any_host("::"))
        self.assertTrue(netutil.is_any_host(""))
        self.assertFalse(netutil.is_any_host("127.0.0.1"))
        self.assertEqual(netutil.host_url("127.0.0.1", 8080), "http://127.0.0.1:8080/")
        self.assertTrue(netutil.guess_lan_address())


class LineStoreTest(unittest.TestCase):
    def test_set_get_remove_and_file_format(self):
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "store.txt"
            store = kvstore.LineStore(path)
            store.set("a", "1")
            store.set("b", "2")
            self.assertEqual(store.get("a"), "1")
            self.assertEqual(store.all(), {"a": "1", "b": "2"})
            self.assertEqual(path.read_text("utf-8"), "a\x1f1\nb\x1f2\n")
            store.set("a", "")
            self.assertIsNone(store.get("a"))
            store.remove("b")
            self.assertEqual(kvstore.LineStore(path).all(), {})

    def test_allow_empty(self):
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "store.txt"
            store = kvstore.LineStore(path, allow_empty=True)
            store.set("a", "")
            self.assertEqual(store.get("a"), "")
            self.assertEqual(kvstore.LineStore(path, allow_empty=True).all(), {"a": ""})

    def test_hooks_and_validation(self):
        class Store(kvstore.LineStore):
            def normalize(self, value):
                return " ".join((value or "").split())

            def validate(self, key, value):
                if len(value) > 5:
                    raise ValueError("太长")

            def decode(self, key, value):
                return value.upper()

        with tempfile.TemporaryDirectory() as td:
            store = Store(Path(td) / "store.txt")
            store.set("a", "  x   y ")
            self.assertEqual(store.get("a"), "X Y")
            self.assertEqual(store.all(), {"a": "X Y"})
            with self.assertRaises(ValueError):
                store.set("b", "123456")

    def test_concurrent_writes(self):
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "store.txt"
            store = kvstore.LineStore(path)
            threads = []

            def worker(index):
                store.set("k%d" % index, "v%d" % index)

            for index in range(20):
                thread = threading.Thread(target=worker, args=(index,))
                threads.append(thread)
                thread.start()
            for thread in threads:
                thread.join()
            data = kvstore.LineStore(path).all()
            self.assertEqual(len(data), 20)
            self.assertEqual(data["k7"], "v7")


class _SmokeHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def do_GET(self):
        if self.path.startswith("/api/stream"):
            body = b"event: tick\ndata: {\"n\": 1}\n\n"
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        body = json.dumps({"ok": True}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0)
        payload = json.loads(self.rfile.read(length).decode("utf-8")) if length else {}
        body = json.dumps({"echo": payload}, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


class TestkitTest(unittest.TestCase):
    def test_load_module(self):
        module = testkit.load_module("shared_fileio_probe", Path(fileio.__file__))
        self.assertTrue(hasattr(module, "read_json"))

    def test_server_sse_and_json(self):
        with tempfile.TemporaryDirectory() as td:
            with testkit.serve(_SmokeHandler, static=td, api_prefix="/api") as server:
                status, payload = testkit.json_call(server.base, "/ping")
                self.assertEqual(status, 200)
                self.assertTrue(payload["ok"])

                status, payload = testkit.json_call(server.base, "/echo", {"x": 1})
                self.assertEqual(status, 200)
                self.assertEqual(payload["echo"], {"x": 1})

                conn = http.client.HTTPConnection("127.0.0.1", server.port, timeout=10)
                conn.request("GET", "/api/stream")
                resp = conn.getresponse()
                event, data = testkit.read_sse_event(resp)
                self.assertEqual(event, "tick")
                self.assertEqual(json.loads(data), {"n": 1})
                resp.close()
                conn.close()

    def test_poll_until(self):
        state = {"count": 0}

        def step():
            state["count"] += 1
            return state["count"] >= 3

        self.assertTrue(testkit.poll_until(step, timeout=2, interval=0.01))
        with self.assertRaises(AssertionError):
            testkit.poll_until(lambda: False, timeout=0.05, interval=0.01, message="没等到")


class HomeStoreTest(unittest.TestCase):
    def test_empty_value_removes_row(self):
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "node.tsv"
            store = stores.HomeStore(path, "Node")
            store.set("ws1", "/opt/node20")
            store.set("ws2", "/opt/node18")
            self.assertEqual(store.get("ws1"), "/opt/node20")
            store.set("ws1", "")
            self.assertEqual(store.get("ws1"), "")

    def test_attach_home_marks_missing(self):
        with tempfile.TemporaryDirectory() as td:
            store = stores.HomeStore(Path(td) / "node.tsv", "Node")
            store.set("ok", td)
            store.set("gone", "/nonexistent/nodex")

            snapshot = {"workspaces": [{"id": "ok"}, {"id": "gone"}, {"id": "none"}]}
            out = stores.attach_home(snapshot, store, "node", lambda value: Path(value).is_dir())

            self.assertEqual(out["workspaces"][0]["node"], td)
            self.assertFalse(out["workspaces"][0]["node_missing"])
            self.assertTrue(out["workspaces"][1]["node_missing"])
            self.assertEqual(out["workspaces"][2]["node"], "")


class ParseReserveTest(unittest.TestCase):
    def test_splits_short_and_long_rows(self):
        runid, path, args, gen, row = runner.parse_reserve(
            runner.FS.join(["run1", "/work", "mvn run", "a", "b", "gen"])
        )
        self.assertEqual((runid, path, args, gen), ("run1", "/work", "mvn run", "gen"))
        self.assertEqual(row, runner.FS.join(["a", "b"]))

    def test_leading_empty_field_is_dropped(self):
        runid, path, _args, gen, row = runner.parse_reserve(
            runner.FS.join(["", "run1", "/work", "npm run dev", "line", "gen"])
        )
        self.assertEqual((runid, path, gen), ("run1", "/work", "gen"))
        self.assertEqual(row, "line")

    def test_short_reply_rejected(self):
        with self.assertRaises(runner.ApiError) as caught:
            runner.parse_reserve(runner.FS.join(["run1", "/work"]), "nodex")
        self.assertEqual(caught.exception.status, 500)
        self.assertIn("nodex 没有给出启动参数", caught.exception.message)


if __name__ == "__main__":
    unittest.main()
