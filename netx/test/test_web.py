"""网页接口：flows、status 与静态首页。"""

import json
import sys
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "lib" / "py-shared"))
sys.path.insert(0, str(REPO / "netx" / "lib"))

from netx.db import Database
from netx.web import WebServer, make_handler


class WebTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.db = Database(Path(self.tmp.name) / "netx.db").init()
        self.db.add_flow(
            started=time.time() - 5,
            pid=100,
            uid=1000,
            comm="curl",
            exe="/usr/bin/curl",
            family=4,
            dst_ip="93.184.216.34",
            dst_port=443,
        )
        handler = make_handler(self.db)
        self.server = WebServer(("127.0.0.1", 0), handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base = "http://127.0.0.1:%d" % self.server.server_address[1]

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)

    def _get(self, path):
        with urllib.request.urlopen(self.base + path, timeout=5) as resp:
            return resp.status, resp.headers.get("Content-Type", ""), resp.read()

    def test_flows(self):
        status, ctype, body = self._get("/__netx/api/flows?minutes=60")
        self.assertEqual(status, 200)
        self.assertIn("application/json", ctype)
        payload = json.loads(body)
        self.assertEqual(len(payload["flows"]), 1)
        self.assertEqual(payload["flows"][0]["comm"], "curl")

    def test_status(self):
        status, _, body = self._get("/__netx/api/status")
        self.assertEqual(status, 200)
        payload = json.loads(body)
        self.assertEqual(payload["flows"], 1)
        self.assertIn("state", payload)

    def test_index(self):
        status, ctype, body = self._get("/")
        self.assertEqual(status, 200)
        self.assertIn("text/html", ctype)
        self.assertIn("netx", body.decode("utf-8"))

    def test_unknown_route(self):
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            self._get("/__netx/api/nope")
        self.assertEqual(ctx.exception.code, 404)


if __name__ == "__main__":
    unittest.main()
