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
from web import ApiError

class ToolsMapTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        self.store = Workspaces(Path(self.tmp.name) / "state.json")

    def test_tools_round_trip(self):
        root = self.tmp.name
        item = self.store.add(root, tools={"node": {"root": root, "id": "abc123"}})
        self.assertEqual(self.store.tools(item["id"])["node"]["id"], "abc123")
        self.assertEqual(
            self.store.workspaces()[0]["tools"],
            {"node": {"root": root, "id": "abc123"}},
        )

    def test_missing_tools_is_null_for_legacy(self):
        item = self.store.add(self.tmp.name)
        self.assertEqual(self.store.tools(item["id"]), {})
        self.assertIsNone(self.store.workspaces()[0]["tools"])

    def test_add_existing_with_tools_replaces(self):
        root = self.tmp.name
        item = self.store.add(root, tools={"node": {"root": root, "id": "old"}})
        self.store.add(root, tools={"node": {"root": root, "id": "new"}})
        self.assertEqual(self.store.tools(item["id"])["node"]["id"], "new")

    def test_add_existing_without_tools_keeps(self):
        root = self.tmp.name
        item = self.store.add(root, tools={"node": {"root": root, "id": "keep"}})
        self.store.add(root)
        self.assertEqual(self.store.tools(item["id"])["node"]["id"], "keep")

    def test_set_tools_replaces_whole_block(self):
        item = self.store.add(self.tmp.name)
        first = {
            "node": {"root": "/n", "id": "n1"},
            "jvm": {"root": "/j", "kind": "maven", "id": "j1"},
        }
        self.store.set_tools(item["id"], first)
        self.assertEqual(self.store.tools(item["id"]), first)
        second = {"jvm": {"root": "/j2", "kind": "gradle", "id": "j2"}}
        self.store.set_tools(item["id"], second)
        self.assertEqual(self.store.tools(item["id"]), second)

    def test_set_tools_empty_clears(self):
        item = self.store.add(self.tmp.name)
        self.store.set_tools(item["id"], {"node": {"root": "/n", "id": "n1"}})
        self.store.set_tools(item["id"], {})
        self.assertEqual(self.store.tools(item["id"]), {})
        self.assertEqual(self.store.workspaces()[0]["tools"], {})

    def test_set_tools_unknown_workspace_is_404(self):
        with self.assertRaises(ApiError) as ctx:
            self.store.set_tools("nope", {})
        self.assertEqual(ctx.exception.status, 404)

    def test_remove_returns_item(self):
        item = self.store.add(self.tmp.name)
        self.assertEqual(self.store.remove(item["id"])["id"], item["id"])


if __name__ == "__main__":
    unittest.main()
