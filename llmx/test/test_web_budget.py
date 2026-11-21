"""预算的网页读写：默认值、校验、落盘与本机限制。"""

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "lib" / "py-shared" / "commons"))
sys.path.insert(0, str(REPO / "lib" / "py-shared" / "services"))
sys.path.insert(0, str(REPO / "llmx" / "lib"))

import testkit

from llmx import budget, config as llmx_config
from llmx import web as llmx_web

GOOD = {
    "daily": 1.5,
    "weekly": 10,
    "monthly": 30.25,
    "items": [{"kind": "model", "name": "deepseek-flash", "limit": 20}],
}


class BudgetApiTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.home = Path(self._tmp.name)
        self._env = mock.patch.dict(
            os.environ,
            {"XDG_CACHE_HOME": str(self.home / "cache"), "HOME": str(self.home)},
        )
        self._env.start()
        self.addCleanup(self._env.stop)
        self.config = llmx_config.load()
        self.server = testkit.serve(llmx_web._make_handler(self.config), api_prefix="/api")
        self.addCleanup(self.server.shutdown)

    def test_missing_file_returns_zero_budget(self):
        status, body = testkit.json_call(self.server.base, "/budget")
        self.assertEqual(status, 200)
        self.assertEqual(body, {"daily": 0.0, "weekly": 0.0, "monthly": 0.0, "items": []})

    def test_post_saves_and_get_reads_back(self):
        status, body = testkit.json_call(self.server.base, "/budget", GOOD)
        self.assertEqual(status, 200)
        self.assertEqual(body, GOOD)
        path = budget.budget_path(self.config.paths.state)
        self.assertEqual(json.loads(path.read_text(encoding="utf-8")), GOOD)
        status, body = testkit.json_call(self.server.base, "/budget")
        self.assertEqual(status, 200)
        self.assertEqual(body, GOOD)

    def test_values_are_rounded_to_four_places(self):
        status, body = testkit.json_call(
            self.server.base, "/budget", {"daily": 1.234567, "items": []}
        )
        self.assertEqual(status, 200)
        self.assertEqual(body["daily"], 1.2346)

    def test_invalid_values_are_rejected_without_touching_file(self):
        path = budget.budget_path(self.config.paths.state)
        path.parent.mkdir(parents=True)
        path.write_text(json.dumps(GOOD), encoding="utf-8")
        bad = [
            {"daily": -1},
            {"monthly": "abc"},
            {"items": "x"},
            {"items": [{"kind": "other", "name": "a", "limit": 1}]},
            {"items": [{"kind": "model", "name": "", "limit": 1}]},
            {"items": [{"kind": "model", "name": "a", "limit": 0}]},
            {
                "items": [
                    {"kind": "model", "name": "a", "limit": 1},
                    {"kind": "model", "name": "a", "limit": 2},
                ]
            },
        ]
        for payload in bad:
            status, body = testkit.json_call(self.server.base, "/budget", payload)
            self.assertEqual(status, 400, msg=payload)
            self.assertTrue(body["error"])
        self.assertEqual(json.loads(path.read_text(encoding="utf-8")), GOOD)

    def test_corrupt_file_is_reported(self):
        path = budget.budget_path(self.config.paths.state)
        path.parent.mkdir(parents=True)
        path.write_text("{oops", encoding="utf-8")
        status, body = testkit.json_call(self.server.base, "/budget")
        self.assertEqual(status, 400)
        self.assertIn(str(path), body["error"])

    def test_other_machines_cannot_save(self):
        patched = mock.patch.object(
            llmx_web.netutil, "is_loopback_address", lambda address: False
        )
        with patched:
            status, body = testkit.json_call(self.server.base, "/budget", GOOD)
        self.assertEqual(status, 403)
        self.assertIn("--allow-write", body["error"])
        self.assertFalse(budget.budget_path(self.config.paths.state).exists())


if __name__ == "__main__":
    unittest.main(verbosity=2)
