# @Author: Himmeltala
# @Date: 2026-11-26 09:29:54
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-26 09:29:54
# @FilePath: \idex\tests\test_web_groups.py
# @Description: 网页左侧分组结构的回归测试：整份写入，状态回话与推送都带上它。

"""网页左侧分组结构的回归测试：整份写入，状态回话与推送都带上它。"""

import http.client
import json
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
SERVER = HERE.parent / "src" / "idex" / "web" / "server.py"

sys.path.insert(0, str(HERE.parent.parent / "lib" / "py-shared" / "commons"))
sys.path.insert(0, str(HERE.parent.parent / "lib" / "py-shared" / "services"))
from testkit import json_call, load_module, read_sse_event, serve

web = load_module("idex_web_server_groups", SERVER)


def workspace(wid, root):
    return {"id": wid, "root": root, "vcs": "git", "url": "", "alias": "", "added": 1}


class GroupRouteTest(unittest.TestCase):
    def test_saves_and_reads_back_through_state(self):
        with tempfile.TemporaryDirectory() as td:
            store = web.Workspaces(Path(td) / "state.json")
            store.save([workspace("w1", "/tmp/a")])
            layout = web.LayoutStore(Path(td) / "groups.json")
            handler = type("TestHandler", (web.Handler,), {"store": store, "groups": layout})
            with serve(handler, static=td, api_prefix="/api") as srv:
                base = "http://127.0.0.1:%s" % srv.port
                status, data = json_call(
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

                status, state = json_call(base, "/api/state")
                self.assertEqual(status, 200)
                self.assertEqual(state["groups"], data["groups"])
                self.assertEqual(len(state["workspaces"]), 1)

    def test_stream_pushes_when_groups_change(self):
        with tempfile.TemporaryDirectory() as td:
            store = web.Workspaces(Path(td) / "state.json")
            store.save([workspace("w1", "/tmp/a")])
            layout = web.LayoutStore(Path(td) / "groups.json")
            stream = web.StateStream(
                [Path(td) / "state.json", Path(td) / "groups.json"],
                lambda: {"workspaces": store.workspaces(), "groups": layout.nodes()},
            )
            stream.start()
            handler = type("TestHandler", (web.Handler,), {"store": store, "groups": layout, "state_stream": stream})
            with serve(handler, static=td, api_prefix="/api") as srv:
                conn = http.client.HTTPConnection("127.0.0.1", srv.port, timeout=10)
                conn.request("GET", "/api/state/stream")
                resp = conn.getresponse()
                self.assertEqual(resp.status, 200)
                _, data = read_sse_event(resp)
                self.assertEqual(json.loads(data)["groups"], [])

                layout.set([{"kind": "group", "id": "g1", "name": "前端"}])
                _, data = read_sse_event(resp)
                self.assertEqual(json.loads(data)["groups"][0]["id"], "g1")

                resp.close()
                conn.close()


if __name__ == "__main__":
    unittest.main(verbosity=2)
