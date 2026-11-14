"""网页模式状态 SSE 的回归测试：状态文件一变就推一份。"""

import http.client
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "lib" / "py-shared"))

import testkit

SERVER = REPO / "mvnx" / "lib" / "mvnx" / "web" / "server.py"
web = testkit.load_module("mvnx_web_server", SERVER)


class StateSseTest(unittest.TestCase):
    def test_pushes_when_state_file_changes(self):
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "state.tsv"
            path.write_text("one\n", encoding="utf-8")
            ticks = []
            stream = web.StateStream(
                [path],
                build=lambda: {"size": path.stat().st_size},
                tick=lambda: ticks.append(1),
            )
            stream.start()
            handler = type("TestHandler", (web.Handler,), {})
            with testkit.serve(handler, static=td, api_prefix="/api", state_stream=stream) as srv:
                conn = http.client.HTTPConnection("127.0.0.1", srv.port, timeout=10)
                conn.request("GET", "/api/state/stream")
                resp = conn.getresponse()
                self.assertEqual(resp.status, 200)
                self.assertEqual(resp.getheader("Content-Type"), "text/event-stream; charset=utf-8")

                event, data = testkit.read_sse_event(resp)
                self.assertEqual(event, "state")
                self.assertEqual(json.loads(data)["size"], 4)

                stat = path.stat()
                path.write_text("one\ntwo\n", encoding="utf-8")
                os.utime(path, ns=(stat.st_atime_ns, stat.st_mtime_ns + 1000000))
                event, data = testkit.read_sse_event(resp)
                self.assertEqual(event, "state")
                self.assertEqual(json.loads(data)["size"], 8)
                # 有页面连着的时候才收拾运行记录。
                self.assertTrue(ticks)

                resp.close()
                conn.close()


if __name__ == "__main__":
    unittest.main()
