"""用户级 CLAUDE.md 的网页读写与本机限制。"""

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

from llmx import config as llmx_config
from llmx import web as llmx_web

TEXT = "# 规则\n\n写完代码不要顺手编译。\n"


class MemoryApiTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.home = Path(self._tmp.name)
        env = {key: value for key, value in os.environ.items() if not key.startswith("LLMX_")}
        env.update({"HOME": str(self.home), "XDG_CACHE_HOME": str(self.home / "cache")})
        patcher = mock.patch.dict(os.environ, env, clear=True)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.config = llmx_config.load()
        self.server = testkit.serve(llmx_web._make_handler(self.config), api_prefix="/api")
        self.addCleanup(self.server.shutdown)

    def test_missing_file_reads_as_empty(self):
        status, body = testkit.json_call(self.server.base, "/claude/memory")
        self.assertEqual(status, 200)
        self.assertFalse(body["exists"])
        self.assertEqual(body["text"], "")
        self.assertTrue(body["writable"])
        self.assertEqual(Path(body["path"]), self.home / ".claude" / "CLAUDE.md")

    def test_save_creates_file_and_reads_back(self):
        status, body = testkit.json_call(self.server.base, "/claude/memory", {"text": TEXT})
        self.assertEqual(status, 200)
        path = self.home / ".claude" / "CLAUDE.md"
        self.assertEqual(path.read_text(encoding="utf-8"), TEXT)
        self.assertEqual(body["size"], len(TEXT.encode("utf-8")))

        status, body = testkit.json_call(self.server.base, "/claude/memory")
        self.assertEqual(status, 200)
        self.assertTrue(body["exists"])
        self.assertEqual(body["text"], TEXT)

    def test_other_machines_cannot_read_or_write(self):
        with mock.patch.object(
            llmx_web.netutil, "is_loopback_address", lambda address: False
        ):
            status, body = testkit.json_call(self.server.base, "/claude/memory")
            self.assertEqual(status, 403)
            self.assertIn("--allow-write", body["error"])
            status, _ = testkit.json_call(
                self.server.base, "/claude/memory", {"text": TEXT}
            )
            self.assertEqual(status, 403)
        self.assertFalse((self.home / ".claude" / "CLAUDE.md").exists())


if __name__ == "__main__":
    unittest.main(verbosity=2)
