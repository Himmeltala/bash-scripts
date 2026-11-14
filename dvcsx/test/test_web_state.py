"""网页登记表 SSE 的回归测试：state.json 一变就推一份。"""

import http.client
import json
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
SERVER = HERE.parent / "lib" / "dvcsx" / "web" / "server.py"

# 测试按 python3 -I 跑，共享层不在 sys.path 上，显式加进去。
sys.path.insert(0, str(HERE.parent.parent / "lib" / "py-shared"))
from testkit import load_module, read_sse_event, serve

web = load_module("dvcsx_web_server", SERVER)


def workspace(wid, root):
    return {"id": wid, "root": root, "vcs": "git", "url": "", "alias": "", "added": 1}


class StateSseTest(unittest.TestCase):
    def test_pushes_when_workspace_list_changes(self):
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "state.json"
            store = web.Workspaces(str(path))
            store.save([workspace("w1", "/tmp/a")])

            stream = web.StateStream(str(path), lambda: {"workspaces": store.workspaces()})
            stream.start()
            handler = type("TestHandler", (web.Handler,), {"state_stream": stream})
            with serve(handler, static=Path(td), api_prefix="/api") as server:
                conn = http.client.HTTPConnection("127.0.0.1", server.port, timeout=10)
                conn.request("GET", "/api/state/stream")
                resp = conn.getresponse()
                self.assertEqual(resp.status, 200)
                self.assertEqual(resp.getheader("Content-Type"), "text/event-stream; charset=utf-8")

                event, data = read_sse_event(resp)
                self.assertEqual(event, "state")
                self.assertEqual(len(json.loads(data)["workspaces"]), 1)

                store.save([workspace("w1", "/tmp/a"), workspace("w2", "/tmp/b")])
                event, data = read_sse_event(resp)
                self.assertEqual(event, "state")
                self.assertEqual(len(json.loads(data)["workspaces"]), 2)

                resp.close()
                conn.close()


if __name__ == "__main__":
    unittest.main()
