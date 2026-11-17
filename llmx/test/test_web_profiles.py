"""配置档的网页读写：增删改、应用、备份、权限与本机限制。"""

import os
import stat
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock
from urllib.parse import quote

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "lib" / "py-shared" / "commons"))
sys.path.insert(0, str(REPO / "lib" / "py-shared" / "services"))
sys.path.insert(0, str(REPO / "llmx" / "lib"))

import testkit

from llmx import config as llmx_config
from llmx import profiles as llmx_profiles
from llmx import web as llmx_web

SETTINGS = '{\n  "env": {"FOO": "bar"}\n}\n'
OTHER = '{\n  "env": {"FOO": "baz"}\n}\n'


class Base(unittest.TestCase):
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

    @property
    def claude_dir(self):
        return self.home / ".claude"

    @property
    def profile_dir(self):
        return self.home / "cache" / "llmx" / "profiles" / "claude"

    def call(self, method, path, body=None):
        return testkit.json_call(self.server.base, path, body)


class ProfileApiTest(Base):
    def create(self, name, source="blank", origin=None):
        body = {"name": name, "from": source}
        if origin is not None:
            body["source"] = origin
        return self.call("POST", "/profiles/claude/create", body)

    def test_empty_list_points_at_settings_json(self):
        status, body = self.call("GET", "/profiles/claude")
        self.assertEqual(status, 200)
        self.assertEqual(body["profiles"], [])
        self.assertEqual(body["target"]["path"], str(self.claude_dir / "settings.json"))
        self.assertFalse(body["target"]["exists"])
        self.assertTrue(body["writable"])
        self.assertEqual(Path(body["dir"]), self.profile_dir)

    def test_create_save_and_read_back(self):
        status, _ = self.create("工作")
        self.assertEqual(status, 200)
        path = self.profile_dir / "工作.json"
        self.assertTrue(path.is_file())
        self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)

        status, body = self.call(
            "POST", "/profiles/claude/save", {"name": "工作", "text": SETTINGS}
        )
        self.assertEqual(status, 200)
        self.assertEqual(path.read_text(encoding="utf-8"), SETTINGS)

        status, body = self.call("GET", "/profiles/claude/file?name=" + quote("工作"))
        self.assertEqual(status, 200)
        self.assertEqual(body["text"], SETTINGS)

        status, body = self.call("GET", "/profiles/claude")
        names = [item["name"] for item in body["profiles"]]
        self.assertEqual(names, ["工作"])
        self.assertFalse(body["profiles"][0]["applied"])

    def test_invalid_json_is_rejected_without_touching_file(self):
        self.assertEqual(self.create("工作")[0], 200)
        self.call("POST", "/profiles/claude/save", {"name": "工作", "text": SETTINGS})
        status, body = self.call(
            "POST", "/profiles/claude/save", {"name": "工作", "text": "["}
        )
        self.assertEqual(status, 400)
        self.assertIn("JSON", body["error"])
        path = self.profile_dir / "工作.json"
        self.assertEqual(path.read_text(encoding="utf-8"), SETTINGS)

        status, body = self.call(
            "POST", "/profiles/claude/save", {"name": "工作", "text": "[1, 2]"}
        )
        self.assertEqual(status, 400)
        self.assertIn("对象", body["error"])

    def test_names_cannot_escape_profile_dir(self):
        for name in ("../evil", "a/b", ".hidden", "x."):
            status, body = self.create(name)
            self.assertEqual(status, 400, name)
            self.assertFalse((self.home / "cache" / "llmx" / "evil.json").exists())
        status, body = self.create("x" * 65)
        self.assertEqual(status, 400)

    def test_duplicate_create_and_rename(self):
        self.assertEqual(self.create("a")[0], 200)
        status, body = self.create("a")
        self.assertEqual(status, 400)
        self.assertIn("已经存在", body["error"])

        self.assertEqual(self.create("b")[0], 200)
        status, _ = self.call(
            "POST", "/profiles/claude/rename", {"from": "a", "to": "b"}
        )
        self.assertEqual(status, 400)
        status, _ = self.call(
            "POST", "/profiles/claude/rename", {"from": "a", "to": "c"}
        )
        self.assertEqual(status, 200)
        self.assertTrue((self.profile_dir / "c.json").is_file())
        self.assertFalse((self.profile_dir / "a.json").exists())

    def test_create_from_settings_and_from_profile(self):
        self.claude_dir.mkdir(parents=True)
        (self.claude_dir / "settings.json").write_text(SETTINGS, encoding="utf-8")
        status, _ = self.create("复制自生效", "settings")
        self.assertEqual(status, 200)
        self.assertEqual(
            (self.profile_dir / "复制自生效.json").read_text(encoding="utf-8"), SETTINGS
        )
        status, _ = self.create("再复制", "profile", "复制自生效")
        self.assertEqual(status, 200)
        self.assertEqual(
            (self.profile_dir / "再复制.json").read_text(encoding="utf-8"), SETTINGS
        )

    def test_delete_only_removes_profile(self):
        self.claude_dir.mkdir(parents=True)
        (self.claude_dir / "settings.json").write_text(SETTINGS, encoding="utf-8")
        self.assertEqual(self.create("工作")[0], 200)
        self.assertEqual(self.call("POST", "/profiles/claude/delete", {"name": "工作"})[0], 200)
        self.assertFalse((self.profile_dir / "工作.json").exists())
        self.assertTrue((self.claude_dir / "settings.json").is_file())

    def test_apply_backs_up_and_keeps_mode(self):
        self.claude_dir.mkdir(parents=True)
        target = self.claude_dir / "settings.json"
        target.write_text(SETTINGS, encoding="utf-8")
        os.chmod(target, 0o640)

        self.assertEqual(self.create("工作")[0], 200)
        self.assertEqual(
            self.call("POST", "/profiles/claude/save", {"name": "工作", "text": OTHER})[0],
            200,
        )
        status, body = self.call("GET", "/profiles/claude/diff?name=" + quote("工作"))
        self.assertEqual(status, 200)
        self.assertIn("---", body["text"])
        self.assertFalse(body["applied"])

        status, body = self.call("POST", "/profiles/claude/apply", {"name": "工作"})
        self.assertEqual(status, 200)
        self.assertEqual(target.read_text(encoding="utf-8"), OTHER)
        self.assertEqual(stat.S_IMODE(target.stat().st_mode), 0o640)
        backup = Path(body["backup"])
        self.assertTrue(backup.is_file())
        self.assertEqual(backup.read_text(encoding="utf-8"), SETTINGS)
        self.assertEqual(backup.parent, self.home / "cache" / "llmx" / "backups" / "claude")

        status, body = self.call("GET", "/profiles/claude")
        self.assertTrue(body["profiles"][0]["applied"])

    def test_backups_rotate(self):
        self.claude_dir.mkdir(parents=True)
        target = self.claude_dir / "settings.json"
        target.write_text(SETTINGS, encoding="utf-8")
        for _ in range(llmx_profiles.BACKUP_KEEP + 3):
            llmx_profiles.backup_settings(self.config.paths, target)
        kept = list((self.home / "cache" / "llmx" / "backups" / "claude").glob("*.json"))
        self.assertEqual(len(kept), llmx_profiles.BACKUP_KEEP)

    def test_other_machines_can_list_but_not_read_or_write(self):
        self.assertEqual(self.create("工作")[0], 200)
        patched = mock.patch.object(
            llmx_web.netutil, "is_loopback_address", lambda address: False
        )
        with patched:
            status, body = self.call("GET", "/profiles/claude")
            self.assertEqual(status, 200)
            self.assertFalse(body["writable"])

            status, body = self.call("GET", "/profiles/claude/file?name=" + quote("工作"))
            self.assertEqual(status, 403)
            self.assertIn("--allow-write", body["error"])

            status, _ = self.call("GET", "/profiles/claude/diff?name=" + quote("工作"))
            self.assertEqual(status, 403)

            status, _ = self.call(
                "POST", "/profiles/claude/save", {"name": "工作", "text": OTHER}
            )
            self.assertEqual(status, 403)


class AllowWriteTest(Base):
    def test_allow_write_opens_reads_and_writes(self):
        self.assertEqual(
            testkit.json_call(
                self.server.base, "/profiles/claude/create", {"name": "工作"}
            )[0],
            200,
        )
        config = llmx_config.load()
        with mock.patch.object(
            llmx_web.netutil, "is_loopback_address", lambda address: False
        ):
            server = testkit.serve(
                llmx_web._make_handler(config, allow_write=True), api_prefix="/api"
            )
            self.addCleanup(server.shutdown)
            status, body = testkit.json_call(server.base, "/profiles/claude/file?name=" + quote("工作"))
            self.assertEqual(status, 200)
            self.assertIn("text", body)


if __name__ == "__main__":
    unittest.main(verbosity=2)
