"""命令行：flows 的表格与 JSON、status。"""

import io
import json
import os
import sys
import tempfile
import time
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest import mock

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "netx" / "lib"))

from netx import cli
from netx.db import Database


class CliTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.db_path = Path(self.tmp.name) / "netx.db"
        self.db = Database(self.db_path).init()
        self.db.add_flow(
            started=time.time() - 10,
            pid=100,
            uid=1000,
            comm="curl",
            exe="/usr/bin/curl",
            family=4,
            dst_ip="93.184.216.34",
            dst_port=443,
        )
        self.env = mock.patch.dict(os.environ, {"NETX_DB": str(self.db_path)})
        self.env.start()
        self.addCleanup(self.env.stop)

    def _run(self, argv):
        out = io.StringIO()
        with redirect_stdout(out):
            code = cli.main(argv)
        return code, out.getvalue()

    def test_flows_json(self):
        code, text = self._run(["flows", "--json"])
        self.assertEqual(code, 0)
        rows = json.loads(text)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["comm"], "curl")
        self.assertEqual(rows[0]["dst_port"], 443)
        self.assertIn("duration", rows[0])

    def test_flows_table(self):
        code, text = self._run(["flows"])
        self.assertEqual(code, 0)
        self.assertIn("curl", text)
        self.assertIn("93.184.216.34:443", text)

    def test_status_json(self):
        self.db.set_meta("collector_state", "running")
        self.db.set_meta("collector_pid", "123")
        code, text = self._run(["status", "--json"])
        self.assertEqual(code, 0)
        payload = json.loads(text)
        self.assertEqual(payload["state"], "running")
        self.assertEqual(payload["pid"], 123)
        self.assertEqual(payload["flows"], 1)
        self.assertGreater(payload["db_bytes"], 0)
        self.assertEqual(payload["details"], 0)

    def test_parse_duration(self):
        self.assertEqual(cli.parse_duration("7d"), 7 * 86400)
        self.assertEqual(cli.parse_duration("12h"), 12 * 3600)
        self.assertEqual(cli.parse_duration("30m"), 30 * 60)
        self.assertEqual(cli.parse_duration("45s"), 45)
        self.assertEqual(cli.parse_duration("3"), 3 * 86400)
        for bad in ("abc", "0d", "-1d", "5w", ""):
            with self.assertRaises(ValueError):
                cli.parse_duration(bad)

    def _end_current_flow(self):
        rows = self.db.flows(minutes=None)
        self.assertEqual(len(rows), 1)
        self.db.end_flow(rows[0]["id"], time.time())
        return rows[0]["id"]

    def test_clean_all_with_yes_removes_ended(self):
        self._end_current_flow()
        code, text = self._run(["clean", "--all", "--yes"])
        self.assertEqual(code, 0)
        self.assertEqual(self.db.count_flows(), 0)
        self.assertIn("已删除", text)

    def test_clean_dry_run_keeps_rows(self):
        self._end_current_flow()
        code, text = self._run(["clean", "--all", "--dry-run"])
        self.assertEqual(code, 0)
        self.assertEqual(self.db.count_flows(), 1)
        self.assertIn("预览", text)

    def test_clean_without_yes_in_non_interactive_fails(self):
        self._end_current_flow()
        with mock.patch.object(sys.stdin, "isatty", return_value=False):
            code, _text = self._run(["clean", "--all"])
        self.assertEqual(code, 2)
        self.assertEqual(self.db.count_flows(), 1)


if __name__ == "__main__":
    unittest.main()
