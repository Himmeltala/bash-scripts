"""网页头部性能指标的 SSE 回归测试。"""

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


class MetricsSseTest(unittest.TestCase):
    def test_streams_one_snapshot(self):
        with tempfile.TemporaryDirectory() as td:
            metrics = web.MetricsStream(web.METRICS)
            metrics.start()
            handler = type("TestHandler", (web.Handler,), {})
            with testkit.serve(handler, static=td, api_prefix="/api", metrics_stream=metrics) as srv:
                conn = http.client.HTTPConnection("127.0.0.1", srv.port, timeout=10)
                conn.request("GET", "/api/metrics/stream")
                resp = conn.getresponse()
                self.assertEqual(resp.status, 200)
                self.assertEqual(resp.getheader("Content-Type"), "text/event-stream; charset=utf-8")

                event, data = testkit.read_sse_event(resp)
                payload = json.loads(data)
                self.assertEqual(event, "metrics")
                for key in ("time", "cpu", "mem", "disk"):
                    self.assertIn(key, payload)

                resp.close()
                conn.close()


if __name__ == "__main__":
    unittest.main()
