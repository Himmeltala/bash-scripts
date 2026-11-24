"""页面日志存储：追加、分页、按级别筛选、清空与条数上限。"""

import sys, tempfile, unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path[:0] = [
    str(REPO / "lib" / "py-shared" / "commons"),
    str(REPO / "lib" / "py-shared" / "services"),
    str(REPO / "idex" / "src" / "idex"),
    str(REPO / "idex" / "src" / "idex" / "web"),
]
from logs_store import LogStore


class LogStoreTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / "logs.jsonl"

    def test_add_read_newest_first(self):
        store = LogStore(self.path)
        store.add("info", "第一条")
        store.add("error", "第二条", "Traceback")
        data = store.read()
        self.assertEqual([item["message"] for item in data["items"]], ["第二条", "第一条"])
        self.assertEqual(data["counts"], {"error": 1, "warning": 0, "info": 1})
        self.assertEqual(data["items"][0]["detail"], "Traceback")

    def test_pagination_before(self):
        store = LogStore(self.path)
        for index in range(5):
            store.add("info", "第 %d 条" % index)
        first = store.read(limit=2)
        self.assertTrue(first["has_more"])
        self.assertEqual(len(first["items"]), 2)
        second = store.read(limit=2, before=first["next_before"])
        self.assertEqual([item["id"] for item in second["items"]], [3, 2])
        last = store.read(limit=2, before=second["next_before"])
        self.assertEqual([item["id"] for item in last["items"]], [1])
        self.assertFalse(last["has_more"])

    def test_filter_by_level(self):
        store = LogStore(self.path)
        store.add("info", "正常")
        store.add("warning", "告警")
        store.add("error", "错误")
        data = store.read(level="warning")
        self.assertEqual([item["message"] for item in data["items"]], ["告警"])
        self.assertEqual(data["total"], 3)

    def test_reload_keeps_items_and_seq(self):
        store = LogStore(self.path)
        store.add("info", "旧条目")
        store.clear()
        store.add("info", "清空后")
        again = LogStore(self.path)
        data = again.read()
        self.assertEqual([item["message"] for item in data["items"]], ["清空后"])
        self.assertGreater(data["items"][0]["id"], 1)

    def test_round_caps_entries(self):
        store = LogStore(self.path, max_entries=3)
        for index in range(5):
            store.add("info", "第 %d 条" % index)
        data = store.read()
        self.assertEqual([item["message"] for item in data["items"]], ["第 4 条", "第 3 条", "第 2 条"])

    def test_empty_message_skipped(self):
        store = LogStore(self.path)
        self.assertIsNone(store.add("info", "   "))
        self.assertEqual(store.read()["items"], [])


if __name__ == "__main__":
    unittest.main()
