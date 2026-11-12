"""网页头部性能指标的 SSE 回归测试。"""

import http.client
import importlib.util
import json
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


class MetricsSseTest(unittest.TestCase):
    def test_streams_one_snapshot(self):
        with tempfile.TemporaryDirectory() as td:
            handler = type(
                "TestHandler",
                (web.Handler,),
                {"api_prefix": "/api", "static": Path(td)},
            )
            httpd = ThreadingHTTPServer(("127.0.0.1", 0), handler)
            httpd.daemon_threads = True
            threading.Thread(target=httpd.serve_forever, daemon=True).start()
            try:
                conn = http.client.HTTPConnection("127.0.0.1", httpd.server_address[1], timeout=10)
                conn.request("GET", "/api/metrics/stream")
                resp = conn.getresponse()
                self.assertEqual(resp.status, 200)
                self.assertEqual(resp.getheader("Content-Type"), "text/event-stream; charset=utf-8")

                event, data = read_event(resp)
                payload = json.loads(data)
                self.assertEqual(event, "metrics")
                for key in ("time", "cpu", "mem", "disk"):
                    self.assertIn(key, payload)

                resp.close()
                conn.close()
            finally:
                httpd.shutdown()
                httpd.server_close()


if __name__ == "__main__":
    unittest.main()
