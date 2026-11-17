"""采集事件：内容分片的十六进制还原。"""

import sys
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "netx" / "lib"))

from netx import events


class PayloadEventTest(unittest.TestCase):
    def test_parse_payload_event(self):
        event = events.parse("P\t100\t5\t123456789\t11\t68656c6c6f")
        self.assertIsNotNone(event)
        self.assertEqual(event["type"], "payload")
        self.assertEqual((event["pid"], event["fd"], event["nsecs"]), (100, 5, 123456789))
        self.assertEqual(event["length"], 11)
        self.assertEqual(event["data"], b"hello")

    def test_parse_payload_tolerates_spaces_in_hex(self):
        event = events.parse("P\t1\t2\t3\t4\t68 65 6c 6c 6f")
        self.assertEqual(event["data"], b"hello")

    def test_parse_payload_rejects_bad_hex(self):
        self.assertIsNone(events.parse("P\t1\t2\t3\t4\tzz"))
        self.assertIsNone(events.parse("P\t1\t2\t3\t4\t6"))

    def test_parse_payload_rejects_wrong_columns(self):
        self.assertIsNone(events.parse("P\t1\t2\t3\t4"))
        self.assertIsNone(events.parse("P\ta\t2\t3\t4\t00"))


if __name__ == "__main__":
    unittest.main()
