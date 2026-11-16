"""头部性能指标推送的回归：连上先给一份完整指标。"""

import http.client
import json
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
SERVER = HERE.parent / "lib" / "dvcsx" / "web" / "server.py"

sys.path.insert(0, str(HERE.parent.parent / "lib" / "py-shared"))
from testkit import load_module, read_sse_event, serve

web = load_module("dvcsx_web_server_metrics", SERVER)


class MetricsStreamTest(unittest.TestCase):
    def test_stream_sends_metrics(self):
        with tempfile.TemporaryDirectory() as td:
            stream = web.MetricsStream(web.METRICS)
            stream.start()
            handler = type("TestHandler", (web.Handler,), {"metrics_stream": stream})
            with serve(handler, static=td, api_prefix="/api") as srv:
                conn = http.client.HTTPConnection("127.0.0.1", srv.port, timeout=10)
                conn.request("GET", "/api/metrics/stream")
                resp = conn.getresponse()
                self.assertEqual(resp.status, 200)
                self.assertEqual(resp.getheader("Content-Type"), "text/event-stream; charset=utf-8")

                event, data = read_sse_event(resp)
                self.assertEqual(event, "metrics")
                payload = json.loads(data)
                for key in ("time", "cpu", "mem", "disk", "net"):
                    self.assertIn(key, payload)

                resp.close()
                conn.close()


if __name__ == "__main__":
    unittest.main(verbosity=2)
