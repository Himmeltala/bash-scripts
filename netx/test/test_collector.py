"""采集器：行事件入库、map 快照、进程退出后的状态。"""

import os
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "netx" / "lib"))

from netx.collector import Collector
from netx.db import Database
from netx.tracker import FlowTracker


class CollectorTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.db = Database(Path(self.tmp.name) / "netx.db").init()
        self.tracker = FlowTracker(
            self.db,
            proc_info=lambda pid: {"comm": "curl", "exe": "/usr/bin/curl", "uid": 1000},
        )

    def _collector(self, **kw):
        return Collector(
            self.db,
            self.tracker,
            log_file=Path(self.tmp.name) / "collector.log",
            restart_delay=0.05,
            nonce="T",
            **kw,
        )

    def test_feed_line(self):
        collector = self._collector()
        self.assertTrue(collector.feed_line("T\tC\t100\t1000\t5\t4\tf39342ac\t443\tcurl"))
        self.assertTrue(collector.feed_line("T\tB\t100\t5\t120"))
        self.assertTrue(collector.feed_line("@bytes[100, 5]: 80"))
        self.assertTrue(collector.feed_line("T\tK\t100\t5"))
        self.assertFalse(collector.feed_line("Attaching 4 probes..."))

        row = self.db.flows(minutes=None)[0]
        self.assertEqual(row["bytes_out"], 200)
        self.assertIsNotNone(row["ended"])
        self.assertGreater(collector.status()["last_event_at"], 0)

    def test_feed_payload_line(self):
        collector = self._collector()
        raw = b"GET /x HTTP/1.1\r\nHost: c.test\r\n\r\n"
        self.assertTrue(collector.feed_line("T\tC\t100\t1000\t5\t4\tf39342ac\t443\tcurl"))
        self.assertTrue(
            collector.feed_line("T\tP\t100\t5\t1\t%d\t%s" % (len(raw), raw.hex()))
        )
        self.assertTrue(collector.feed_line("T\tK\t100\t5"))
        detail = self.db.detail(self.db.flows(minutes=None)[0]["id"])
        self.assertEqual(detail["host"], "c.test")
        self.assertFalse(collector.feed_line("T\tP\t100\t5\t3\tzz"))

    def test_bpftrace_env_limits(self):
        collector = self._collector()
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("BPFTRACE_MAX_STRLEN", None)
            os.environ.pop("BPFTRACE_MAX_MAP_KEYS", None)
            env = collector._bpftrace_env()
        self.assertEqual(env["BPFTRACE_MAX_STRLEN"], "200")
        self.assertEqual(env["BPFTRACE_MAX_MAP_KEYS"], "262144")

    def test_script_nonce_is_literal(self):
        collector = self._collector()
        path = Path(collector.command[-1])
        text = path.read_text(encoding="utf-8")
        code = "\n".join(
            line for line in text.splitlines() if not line.lstrip().startswith("//")
        )
        self.assertIn('"T\\tC\\t', code)
        self.assertNotIn("str($1)", code)
        self.assertNotIn("__NETX_NONCE__", text)

    def test_process_lifecycle(self):
        code = (
            "import time\n"
            "print('T\\tC\\t100\\t1000\\t5\\t4\\tf39342ac\\t443\\tcurl', flush=True)\n"
            "print('T\\tB\\t100\\t5\\t64', flush=True)\n"
            "time.sleep(5)\n"
        )
        collector = self._collector(command=[sys.executable, "-u", "-c", code])
        collector.start()
        try:
            deadline = time.time() + 5
            while time.time() < deadline and self.db.count_flows() == 0:
                time.sleep(0.05)
            self.assertEqual(self.db.count_flows(), 1)
            self.assertEqual(collector.status()["state"], "running")
        finally:
            collector.stop(timeout=2)

        self.assertEqual(collector.status()["state"], "stopped")
        row = self.db.flows(minutes=None)[0]
        self.assertIsNotNone(row["ended"])


if __name__ == "__main__":
    unittest.main()
