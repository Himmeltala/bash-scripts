"""工作区记录里的工具映射：登记、读取、删除，以及旧记录没有这项时为 None。"""

import sys, tempfile, unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path[:0] = [
    str(REPO / "lib" / "py-shared" / "commons"),
    str(REPO / "lib" / "py-shared" / "services"),
    str(REPO / "idex" / "lib" / "idex" / "web"),
]
from server_stores import Workspaces

class ToolsMapTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        self.store = Workspaces(Path(self.tmp.name) / "state.json")

    def test_tools_round_trip(self):
        root = self.tmp.name
        item = self.store.add(root, tools={"node": {"root": root, "id": "abc123"}})
        self.assertEqual(self.store.tools(item["id"])["node"]["id"], "abc123")
        self.assertIn("tools", self.store.workspaces()[0])

    def test_missing_tools_is_null_for_legacy(self):
        item = self.store.add(self.tmp.name)
        self.assertEqual(self.store.tools(item["id"]), {})
        self.assertIsNone(self.store.workspaces()[0]["tools"])

    def test_remove_returns_item(self):
        item = self.store.add(self.tmp.name)
        self.assertEqual(self.store.remove(item["id"])["id"], item["id"])


if __name__ == "__main__":
    unittest.main()
