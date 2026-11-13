"""网页模式状态 SSE 的回归测试：状态文件一变就推一份。"""

import http.client
import importlib.util
import json
import os
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path

SERVER = Path(__file__).resolve().parents[2] / "mvnx" / "lib" / "mvnx" / "web" / "server.py"

spec = importlib.util.spec_from_file_location("mvnx_web_server", SERVER)
web = importlib.util.module_from_spec(spec)
spec.loader.exec_module(web)


def read_event(resp):
    event, data = "", ""
    while True:
        line = resp.readline()
        if not line:
            return event, data
        line = line.decode("utf-8").rstrip("\n")
        if line == "":
            return event, data
        if line.startswith("event:"):
            event = line[6:].strip()
        elif line.startswith("data:"):
            data += line[5:].strip()


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
            handler = type(
                "TestHandler",
                (web.Handler,),
                {"api_prefix": "/api", "static": Path(td), "state_stream": stream},
            )
            httpd = ThreadingHTTPServer(("127.0.0.1", 0), handler)
            httpd.daemon_threads = True
            threading.Thread(target=httpd.serve_forever, daemon=True).start()
            try:
                conn = http.client.HTTPConnection("127.0.0.1", httpd.server_address[1], timeout=10)
                conn.request("GET", "/api/state/stream")
                resp = conn.getresponse()
                self.assertEqual(resp.status, 200)
                self.assertEqual(resp.getheader("Content-Type"), "text/event-stream; charset=utf-8")

                event, data = read_event(resp)
                self.assertEqual(event, "state")
                self.assertEqual(json.loads(data)["size"], 4)

                stat = path.stat()
                path.write_text("one\ntwo\n", encoding="utf-8")
                os.utime(path, ns=(stat.st_atime_ns, stat.st_mtime_ns + 1000000))
                event, data = read_event(resp)
                self.assertEqual(event, "state")
                self.assertEqual(json.loads(data)["size"], 8)
                # 有页面连着的时候才收拾运行记录。
                self.assertTrue(ticks)

                resp.close()
                conn.close()
            finally:
                httpd.shutdown()
                httpd.server_close()


if __name__ == "__main__":
    unittest.main()
