"""价格配置的网页读写：路径、生成、校验与本机限制。"""

import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "lib" / "py-shared"))
sys.path.insert(0, str(REPO / "tokx" / "lib"))

import testkit

from tokx import config as tokx_config
from tokx import web as tokx_web

GOOD = """\
[models."deepseek-flash"]
off  = { hit = 0.02, miss = 1.0, output = 4.0 }
peak = { hit = 0.04, miss = 2.0, output = 8.0 }

[peak]
windows = ["09:00-12:00"]
weekdays = [0, 1, 2, 3, 4]
holidays = []
"""


class ConfigPathTest(unittest.TestCase):
    def test_default_path_follows_cache_home(self):
        with tempfile.TemporaryDirectory() as td:
            env = {k: v for k, v in os.environ.items() if k != "TOKX_CONFIG"}
            env["XDG_CACHE_HOME"] = td
            with mock.patch.dict(os.environ, env, clear=True):
                self.assertEqual(
                    tokx_config.config_path(), Path(td) / "tokx" / "config.toml"
                )

    def test_explicit_and_env_still_win(self):
        with tempfile.TemporaryDirectory() as td:
            with mock.patch.dict(os.environ, {"TOKX_CONFIG": str(Path(td) / "a.toml")}):
                self.assertEqual(tokx_config.config_path(), Path(td) / "a.toml")
                self.assertEqual(
                    tokx_config.config_path(str(Path(td) / "b.toml")),
                    Path(td) / "b.toml",
                )


class ConfigTextTest(unittest.TestCase):
    def test_render_round_trips_through_validation(self):
        book = tokx_config.load().book
        text = tokx_config.render(book)
        self.assertIn("deepseek-flash", text)
        tokx_config.validate_text(text)
        parsed = tokx_config.load_from_text(text)
        self.assertEqual(parsed.models["deepseek-flash"].off.hit, 0.02)
        self.assertEqual(parsed.tz.key, book.tz.key)

    def test_syntax_error_is_config_error(self):
        with self.assertRaises(tokx_config.ConfigError):
            tokx_config.validate_text('models = "not a table"\n[x\n')

    def test_missing_off_or_peak_is_config_error(self):
        with self.assertRaises(tokx_config.ConfigError):
            tokx_config.validate_text('[models."m"]\noff = { hit = 1.0 }\n')

    def test_wrong_section_type_is_config_error(self):
        for text in ('models = "x"\n', 'aliases = 1\n', 'peak = "x"\n', 'apis = []\n'):
            with self.assertRaises(tokx_config.ConfigError, msg=text):
                tokx_config.validate_text(text)


class ConfigApiTest(unittest.TestCase):
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
        self.config = tokx_config.load()
        self.server = testkit.serve(tokx_web._make_handler(self.config), api_prefix="/api")
        self.addCleanup(self.server.shutdown)

    def test_get_serves_generated_text_when_file_is_missing(self):
        status, body = testkit.json_call(self.server.base, "/config")
        self.assertEqual(status, 200)
        self.assertFalse(Path(body["path"]).exists())
        self.assertIn("deepseek-flash", body["text"])
        self.assertTrue(body["writable"])
        tokx_config.validate_text(body["text"])

    def test_post_saves_whole_text_and_get_reads_it_back(self):
        status, body = testkit.json_call(self.server.base, "/config", {"text": GOOD})
        self.assertEqual(status, 200)
        saved = Path(body["path"])
        self.assertEqual(saved.read_text(encoding="utf-8"), GOOD)
        status, body = testkit.json_call(self.server.base, "/config")
        self.assertEqual(status, 200)
        self.assertEqual(body["text"], GOOD)

    def test_invalid_text_is_rejected_without_touching_file(self):
        path = tokx_config.config_path()
        path.parent.mkdir(parents=True)
        path.write_text(GOOD, encoding="utf-8")
        status, body = testkit.json_call(
            self.server.base, "/config", {"text": '[models."m"]\noff = {}\n'}
        )
        self.assertEqual(status, 400)
        self.assertIn("off", body["error"])
        self.assertEqual(path.read_text(encoding="utf-8"), GOOD)

    def test_other_machines_cannot_save(self):
        patched = mock.patch.object(
            tokx_web.netutil, "is_loopback_address", lambda address: False
        )
        with patched:
            status, body = testkit.json_call(
                self.server.base, "/config", {"text": GOOD}
            )
        self.assertEqual(status, 403)
        self.assertIn("--allow-write", body["error"])
        self.assertFalse(tokx_config.config_path().exists())

    def test_allow_write_opens_it_to_other_machines(self):
        config = tokx_config.load()
        with mock.patch.object(
            tokx_web.netutil, "is_loopback_address", lambda address: False
        ):
            server = testkit.serve(tokx_web._make_handler(config, allow_write=True), api_prefix="/api")
            self.addCleanup(server.shutdown)
            status, _ = testkit.json_call(server.base, "/config", {"text": GOOD})
        self.assertEqual(status, 200)


if __name__ == "__main__":
    unittest.main(verbosity=2)
