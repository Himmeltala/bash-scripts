"""sqlite 存储：插入、累加字节、结束、过期与 meta。"""

import sys
import tempfile
import time
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "netx" / "lib"))

from netx.db import Database


class DatabaseTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.db = Database(Path(self.tmp.name) / "netx.db").init()

    def _flow(self, started=None, pid=100):
        return self.db.add_flow(
            started=started if started is not None else time.time(),
            pid=pid,
            uid=1000,
            comm="curl",
            exe="/usr/bin/curl",
            family=4,
            dst_ip="93.184.216.34",
            dst_port=443,
        )

    def test_flow_roundtrip(self):
        flow_id = self._flow()
        now = time.time()
        self.db.add_bytes(flow_id, 120, now)
        self.db.add_bytes(flow_id, 80, now)
        self.db.end_flow(flow_id, now + 1)

        rows = self.db.flows(minutes=5)
        self.assertEqual(len(rows), 1)
        row = rows[0]
        self.assertEqual(row["id"], flow_id)
        self.assertEqual(row["comm"], "curl")
        self.assertEqual(row["dst_ip"], "93.184.216.34")
        self.assertEqual(row["dst_port"], 443)
        self.assertEqual(row["bytes_out"], 200)
        self.assertIsNotNone(row["ended"])

    def test_expire_closes_idle_flow(self):
        started = time.time() - 1000
        flow_id = self._flow(started=started)
        closed = self.db.expire(time.time(), idle=300)
        self.assertEqual(closed, 1)
        row = self.db.flows(minutes=None)[0]
        self.assertEqual(row["id"], flow_id)
        self.assertIsNotNone(row["ended"])

    def test_minutes_filter(self):
        flow_id = self._flow(started=time.time() - 600)
        self.db.end_flow(flow_id, time.time() - 500)
        self.assertEqual(self.db.flows(minutes=5), [])
        self.assertEqual(len(self.db.flows(minutes=30)), 1)

    def test_long_active_flow_is_not_hidden(self):
        self._flow(started=time.time() - 600)
        self.assertEqual(len(self.db.flows(minutes=5)), 1)

    def test_meta(self):
        self.db.set_meta("collector_state", "running")
        self.db.set_meta("collector_state", "stopped")
        self.assertEqual(self.db.get_meta("collector_state"), "stopped")
        self.assertEqual(self.db.get_meta("missing", "x"), "x")
        self.assertEqual(self.db.meta()["collector_state"], "stopped")


if __name__ == "__main__":
    unittest.main()
