"""网页左侧分组结构的回归测试：拼进状态回话。"""

import sys
import tempfile
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "lib" / "py-shared"))

import testkit

SERVER = REPO / "nodex" / "lib" / "nodex" / "web" / "server.py"
web = testkit.load_module("nodex_web_server_groups", SERVER)


class GroupPayloadTest(unittest.TestCase):
    def test_state_payload_carries_groups(self):
        with tempfile.TemporaryDirectory() as td:
            state_path = Path(td) / "state.tsv"
            state_path.write_text("", encoding="utf-8")
            state = web.State(state_path)
            nodes = web.NodeStore(Path(td) / "node.tsv")
            aliases = web.AliasStore(Path(td) / "alias.tsv")
            layout = web.LayoutStore(Path(td) / "groups.json")
            layout.set([{"kind": "group", "id": "g1", "name": "前端"}])

            payload = web.state_payload(state, nodes, aliases, None, layout)
            self.assertEqual(payload["workspaces"], [])
            self.assertEqual(
                payload["groups"],
                [{"kind": "group", "id": "g1", "name": "前端", "parent": ""}],
            )


if __name__ == "__main__":
    unittest.main(verbosity=2)
