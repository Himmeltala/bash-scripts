"""网页左侧分组结构的回归测试：整份写入、清洗，并拼进状态回话。"""

import sys
import tempfile
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "lib" / "py-shared"))

import testkit

SERVER = REPO / "mvnx" / "lib" / "mvnx" / "web" / "server.py"
web = testkit.load_module("mvnx_web_server_groups", SERVER)


class GroupRouteTest(unittest.TestCase):
    def test_saves_and_reads_back(self):
        with tempfile.TemporaryDirectory() as td:
            layout = web.LayoutStore(Path(td) / "groups.json")
            handler = type("TestHandler", (web.Handler,), {"layout": layout})
            with testkit.serve(handler, static=td, api_prefix="/api") as srv:
                base = "http://127.0.0.1:%s" % srv.port
                status, data = testkit.json_call(
                    base,
                    "/api/groups",
                    {
                        "nodes": [
                            {"kind": "group", "id": "g1", "name": " 前端 ", "parent": ""},
                            {"kind": "ws", "id": "w1", "parent": "g1"},
                        ]
                    },
                )
                self.assertEqual(status, 200)
                self.assertTrue(data["ok"])
                self.assertEqual([n["id"] for n in data["groups"]], ["g1", "w1"])
                self.assertEqual(layout.nodes(), data["groups"])
                self.assertEqual(data["groups"][0]["name"], "前端")

    def test_state_payload_carries_groups(self):
        with tempfile.TemporaryDirectory() as td:
            state_path = Path(td) / "state.tsv"
            state_path.write_text("", encoding="utf-8")
            state = web.State(state_path)
            jdks = web.JdkStore(Path(td) / "jdk.tsv")
            aliases = web.AliasStore(Path(td) / "alias.tsv")
            layout = web.LayoutStore(Path(td) / "groups.json")
            layout.set([{"kind": "group", "id": "g1", "name": "前端"}])

            payload = web.state_payload(state, jdks, aliases, layout)
            self.assertEqual(payload["workspaces"], [])
            self.assertEqual(
                payload["groups"],
                [{"kind": "group", "id": "g1", "name": "前端", "parent": ""}],
            )


if __name__ == "__main__":
    unittest.main(verbosity=2)
