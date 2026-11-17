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
from netx.parse import parse_payload
from netx.web import WebServer, can_write, make_handler


class WebTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.db = Database(Path(self.tmp.name) / "netx.db").init()
        self.flow_id = self.db.add_flow(
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

    def _post(self, path, body):
        data = json.dumps(body).encode("utf-8")
        request = urllib.request.Request(
            self.base + path,
            data=data,
            method="POST",
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(request, timeout=5) as resp:
                return resp.status, resp.read()
        except urllib.error.HTTPError as exc:
            return exc.code, exc.read()

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

    def test_flow_detail(self):
        raw = b"GET /a HTTP/1.1\r\nHost: d.test\r\n\r\n"
        self.db.set_detail(self.flow_id, raw, parse_payload(raw, dst_port=443))
        status, _, body = self._get("/__netx/api/flow?id=%d" % self.flow_id)
        self.assertEqual(status, 200)
        payload = json.loads(body)
        self.assertEqual(payload["kind"], "http")
        self.assertEqual(payload["parsed"]["host"], "d.test")
        self.assertEqual(payload["raw_hex"], raw.hex())
        self.assertIn("Host: d.test", payload["raw_text"])
        self.assertEqual(payload["flow"]["id"], self.flow_id)

    def test_flow_detail_missing(self):
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            self._get("/__netx/api/flow?id=999")
        self.assertEqual(ctx.exception.code, 404)

    def test_summary(self):
        self.db.set_detail(self.flow_id, b"x", {"kind": "binary"})
        status, _, body = self._get("/__netx/api/summary")
        self.assertEqual(status, 200)
        payload = json.loads(body)
        self.assertEqual((payload["flow_count"], payload["detail_count"]), (1, 1))
        self.assertGreater(payload["db_bytes"], 0)

    def test_clean_all_local(self):
        self.db.end_flow(self.flow_id, time.time())
        status, body = self._post("/__netx/api/clean", {"all": True})
        self.assertEqual(status, 200)
        payload = json.loads(body)
        self.assertEqual(payload["flows"], 1)
        self.assertEqual(self.db.count_flows(), 0)

    def test_clean_requires_scope(self):
        status, _ = self._post("/__netx/api/clean", {})
        self.assertEqual(status, 400)

    def test_post_other_route_still_rejected(self):
        status, _ = self._post("/__netx/api/status", {})
        self.assertEqual(status, 405)

    def test_can_write_gate(self):
        self.assertTrue(can_write(False, "127.0.0.1"))
        self.assertFalse(can_write(False, "192.168.1.5"))
        self.assertTrue(can_write(True, "192.168.1.5"))


if __name__ == "__main__":
    unittest.main()
