"""网页登记表 SSE 的回归测试：state.json 一变就推一份。"""

import http.client
import importlib.util
import json
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
SERVER = HERE.parent / "lib" / "dvcsx" / "web" / "server.py"

spec = importlib.util.spec_from_file_location("dvcsx_web_server", SERVER)
web = importlib.util.module_from_spec(spec)
spec.loader.exec_module(web)


def read_event(resp):
    event, data = "", ""
    while True:
        line = resp.readline()
        if not line:
            return event, data
        line = line.decode("utf-8").rstrip("\n")
        if line == "":
            return event, data
        if line.startswith("event:"):
            event = line[6:].strip()
        elif line.startswith("data:"):
            data += line[5:].strip()


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
            handler = type(
                "TestHandler",
                (web.Handler,),
                {"api_prefix": "/api", "static": Path(td), "state_stream": stream},
            )
            httpd = ThreadingHTTPServer(("127.0.0.1", 0), handler)
            httpd.daemon_threads = True
            threading.Thread(target=httpd.serve_forever, daemon=True).start()
            try:
                conn = http.client.HTTPConnection("127.0.0.1", httpd.server_address[1], timeout=10)
                conn.request("GET", "/api/state/stream")
                resp = conn.getresponse()
                self.assertEqual(resp.status, 200)
                self.assertEqual(resp.getheader("Content-Type"), "text/event-stream; charset=utf-8")

                event, data = read_event(resp)
                self.assertEqual(event, "state")
                self.assertEqual(len(json.loads(data)["workspaces"]), 1)

                store.save([workspace("w1", "/tmp/a"), workspace("w2", "/tmp/b")])
                event, data = read_event(resp)
                self.assertEqual(event, "state")
                self.assertEqual(len(json.loads(data)["workspaces"]), 2)

                resp.close()
                conn.close()
            finally:
                httpd.shutdown()
                httpd.server_close()


if __name__ == "__main__":
    unittest.main()
