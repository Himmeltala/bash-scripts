"""采集器：行事件入库、map 快照、进程退出后的状态。"""

import sys
import tempfile
import time
import unittest
from pathlib import Path

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
