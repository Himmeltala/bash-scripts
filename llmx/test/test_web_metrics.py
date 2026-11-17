"""头部性能指标推送的回归：连上先给一份完整指标。"""

import json
import os
import sys
import tempfile
import unittest
import urllib.request
from pathlib import Path
from unittest import mock

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "lib" / "py-shared" / "commons"))
sys.path.insert(0, str(REPO / "lib" / "py-shared" / "services"))
sys.path.insert(0, str(REPO / "llmx" / "lib"))

import testkit

from llmx import config as llmx_config
from llmx import web as llmx_web


class MetricsStreamTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        home = Path(self._tmp.name)
        env = mock.patch.dict(
            os.environ,
            {"XDG_CACHE_HOME": str(home / "cache"), "HOME": str(home)},
        )
        env.start()
        self.addCleanup(env.stop)
        self.server = testkit.serve(llmx_web._make_handler(llmx_config.load()), api_prefix="/api")
        self.addCleanup(self.server.shutdown)

    def test_stream_sends_metrics(self):
        with urllib.request.urlopen(self.server.url + "/api/metrics/stream", timeout=10) as resp:
            self.assertEqual(resp.status, 200)
            event, data = testkit.read_sse_event(resp)
        self.assertEqual(event, "metrics")
        payload = json.loads(data)
        for key in ("time", "cpu", "mem", "disk", "net"):
            self.assertIn(key, payload)


if __name__ == "__main__":
    unittest.main(verbosity=2)
