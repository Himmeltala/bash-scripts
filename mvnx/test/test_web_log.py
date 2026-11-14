"""网页模式日志 SSE 的回归测试：行缓冲、尾部与增量推送。"""

import http.client
import json
import sys
import tempfile
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "lib" / "py-shared"))

import testkit

SERVER = REPO / "mvnx" / "lib" / "mvnx" / "web" / "server.py"
web = testkit.load_module("mvnx_web_server", SERVER)


class LineBufferTest(unittest.TestCase):
    def test_holds_partial_line(self):
        buf = web.LineBuffer()
        self.assertEqual(buf.feed(b"one\ntw"), "one")
        self.assertEqual(buf.feed(b"o\nthree\n"), "two\nthree")

    def test_handles_split_utf8(self):
        raw = "你好\n".encode("utf-8")
        buf = web.LineBuffer()
        self.assertEqual(buf.feed(raw[:2]), "")
        self.assertEqual(buf.feed(raw[2:]), "你好")


class LastLinesTest(unittest.TestCase):
    def test_returns_tail_and_more_flag(self):
        self.assertEqual(web.last_lines(b"a\nb\nc\n", 2), ("b\nc", True))
        self.assertEqual(web.last_lines(b"a\nb\n", 5), ("a\nb", False))


class SseEventTest(unittest.TestCase):
    def test_event_format(self):
        event = web.sse_event("a\nb", event="append", event_id=12)
        self.assertIn("event: append\n", event)
        self.assertIn("id: 12\n", event)
        self.assertTrue(event.endswith("\n\n"))
        payload = json.loads(event.split("data: ", 1)[1].strip())
        self.assertEqual(payload["text"], "a\nb")


class SseTest(unittest.TestCase):
    def test_sends_tail_then_appended_lines(self):
        with tempfile.TemporaryDirectory() as td:
            logs = Path(td) / "logs"
            runid = "ws1.install.svc.123"
            log = logs / "ws1" / (runid + ".log")
            log.parent.mkdir(parents=True)
            log.write_text("one\ntwo\n", encoding="utf-8")

            handler = type("TestHandler", (web.Handler,), {})
            with testkit.serve(
                handler, static=td, api_prefix="/api", logs=str(logs)
            ) as srv:
                conn = http.client.HTTPConnection("127.0.0.1", srv.port, timeout=5)
                conn.request("GET", "/api/log/stream?run=" + runid)
                resp = conn.getresponse()
                self.assertEqual(resp.status, 200)
                self.assertEqual(resp.getheader("Content-Type"), "text/event-stream; charset=utf-8")

                event, data = testkit.read_sse_event(resp)
                payload = json.loads(data)
                self.assertEqual(event, "tail")
                self.assertEqual(payload["text"], "one\ntwo")
                self.assertFalse(payload["more"])

                with open(log, "a", encoding="utf-8") as fh:
                    fh.write("three\n")
                event, data = testkit.read_sse_event(resp)
                self.assertEqual(event, "append")
                self.assertEqual(json.loads(data)["text"], "three")

                # 退出码写在日志旁边，日志流跟着发一条 exit，压缩任务靠它收尾。
                Path(str(log) + ".code").write_text("7\n", encoding="utf-8")
                event, data = testkit.read_sse_event(resp)
                self.assertEqual(event, "exit")
                self.assertEqual(json.loads(data)["code"], 7)

                resp.close()
                conn.close()


if __name__ == "__main__":
    unittest.main()
