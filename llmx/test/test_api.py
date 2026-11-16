"""地址与配置识别：数据目录、项目级设置、opencode 路由、DSH 冲突与 zstd 缺失提示。"""

import io
import json
import os
import sys
import tempfile
import unittest
from contextlib import redirect_stderr
from pathlib import Path
from unittest import mock

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "lib" / "py-shared"))
sys.path.insert(0, str(REPO / "llmx" / "lib"))

from llmx import api as llmx_api
from llmx import config as llmx_config
from llmx.sources import dsh as dsh_source
from llmx.sources import opencode as opencode_source


def clean_env(**values):
    """去掉会影响结论的环境变量，只留调用方给的那几个。"""
    drop = ("LLMX_", "XDG_", "OPENCODE_", "CLAUDE_CONFIG_DIR", "ANTHROPIC_BASE_URL")
    env = {
        key: value
        for key, value in os.environ.items()
        if not key.startswith(drop) and key != "HOME"
    }
    env.update({key: str(value) for key, value in values.items()})
    return env


def write_json(path: Path, doc: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(doc), encoding="utf-8")


def write_profile(root: Path, name: str, provider: str, address: str) -> None:
    path = root / name / "cordis.patch.yml"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        "- id: llm\n"
        "  config:\n"
        "    providers:\n"
        f"      {provider}:\n"
        f"        baseURL: \"{address}\"\n",
        encoding="utf-8",
    )


class DataPathTest(unittest.TestCase):
    def test_claude_dir_follows_config_dir(self):
        with tempfile.TemporaryDirectory() as td:
            home = Path(td)
            env = clean_env(
                HOME=home, CLAUDE_CONFIG_DIR=home / "profile", XDG_CACHE_HOME=home / "cache"
            )
            with mock.patch.dict(os.environ, env, clear=True):
                config = llmx_config.load()
            self.assertEqual(config.paths.claude, home / "profile")

    def test_opencode_dir_follows_xdg_data_home(self):
        with tempfile.TemporaryDirectory() as td:
            home = Path(td)
            env = clean_env(
                HOME=home, XDG_DATA_HOME=home / "data", XDG_CACHE_HOME=home / "cache"
            )
            with mock.patch.dict(os.environ, env, clear=True):
                config = llmx_config.load()
            self.assertEqual(config.paths.opencode, home / "data" / "opencode")

    def test_llmx_overrides_win(self):
        with tempfile.TemporaryDirectory() as td:
            home = Path(td)
            env = clean_env(
                HOME=home,
                XDG_DATA_HOME=home / "data",
                CLAUDE_CONFIG_DIR=home / "profile",
                LLMX_OPENCODE_DIR=home / "oc",
                LLMX_CLAUDE_DIR=home / "claude",
                XDG_CACHE_HOME=home / "cache",
            )
            with mock.patch.dict(os.environ, env, clear=True):
                config = llmx_config.load()
            self.assertEqual(config.paths.opencode, home / "oc")
            self.assertEqual(config.paths.claude, home / "claude")


class OpencodeDatabaseTest(unittest.TestCase):
    def test_open_code_db_env(self):
        root = Path("/data/opencode")
        with mock.patch.dict(os.environ, {"OPENCODE_DB": "/tmp/a.db"}, clear=False):
            self.assertEqual(opencode_source._database(root), Path("/tmp/a.db"))
        with mock.patch.dict(os.environ, {"OPENCODE_DB": "alt.db"}, clear=False):
            self.assertEqual(opencode_source._database(root), root / "alt.db")
        with mock.patch.dict(os.environ, clean_env(), clear=True):
            self.assertEqual(opencode_source._database(root), root / "opencode.db")


class AddressTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.root = Path(self._tmp.name)
        # 本机 shell 里可能设了地址变量，先把它们摘掉，免得盖过测试数据。
        env = {
            key: value
            for key, value in os.environ.items()
            if key not in ("ANTHROPIC_BASE_URL", "OPENCODE_CONFIG")
        }
        patcher = mock.patch.dict(os.environ, env, clear=True)
        patcher.start()
        self.addCleanup(patcher.stop)

    def book(self, **kwargs):
        return llmx_api.ApiBook.load(
            kwargs.pop("apis", {}),
            claude_dir=kwargs.pop("claude_dir", self.root / "claude"),
            opencode_dir=kwargs.pop("opencode_dir", self.root / "opencode"),
            dsh_profiles=kwargs.pop("profiles", self.root / "profiles"),
        )

    def project(self, name="proj"):
        path = self.root / name
        (path / ".git").mkdir(parents=True)
        return path

    def test_claude_project_settings_precedence(self):
        user = self.root / "claude"
        write_json(user / "settings.json", {"env": {"ANTHROPIC_BASE_URL": "http://user"}})
        project = self.project()
        write_json(
            project / ".claude" / "settings.json",
            {"env": {"ANTHROPIC_BASE_URL": "http://shared"}},
        )
        write_json(
            project / ".claude" / "settings.local.json",
            {"env": {"ANTHROPIC_BASE_URL": "http://local"}},
        )
        book = self.book(claude_dir=user)
        self.assertEqual(book.address("claude", "anthropic", str(project)), "http://local")
        (project / ".claude" / "settings.local.json").unlink()
        self.assertEqual(
            self.book(claude_dir=user).address("claude", "anthropic", str(project)),
            "http://shared",
        )
        (project / ".claude" / "settings.json").unlink()
        self.assertEqual(
            self.book(claude_dir=user).address("claude", "anthropic", str(project)),
            "http://user",
        )

    def test_claude_subdirectory_uses_git_root(self):
        user = self.root / "claude"
        write_json(user / "settings.json", {"env": {"ANTHROPIC_BASE_URL": "http://user"}})
        project = self.project()
        write_json(
            project / ".claude" / "settings.local.json",
            {"env": {"ANTHROPIC_BASE_URL": "http://root"}},
        )
        sub = project / "work" / "sub"
        sub.mkdir(parents=True)
        book = self.book(claude_dir=user)
        self.assertEqual(book.address("claude", "anthropic", str(sub)), "http://root")

    def test_managed_settings_win(self):
        user = self.root / "claude"
        write_json(user / "settings.json", {"env": {"ANTHROPIC_BASE_URL": "http://user"}})
        project = self.project()
        write_json(
            project / ".claude" / "settings.local.json",
            {"env": {"ANTHROPIC_BASE_URL": "http://local"}},
        )
        managed = self.root / "managed-settings.json"
        write_json(managed, {"env": {"ANTHROPIC_BASE_URL": "http://managed"}})
        with mock.patch.object(llmx_api, "CLAUDE_MANAGED", (managed,)):
            book = self.book(claude_dir=user)
            self.assertEqual(
                book.address("claude", "anthropic", str(project)), "http://managed"
            )

    def test_opencode_project_config_wins(self):
        global_dir = self.root / "opencode"
        write_json(
            global_dir / "opencode.json",
            {"provider": {"anthropic": {"options": {"baseURL": "http://global"}}}},
        )
        project = self.project()
        write_json(
            project / "opencode.json",
            {"provider": {"anthropic": {"options": {"baseURL": "http://project"}}}},
        )
        book = self.book(opencode_dir=global_dir)
        self.assertEqual(
            book.address("opencode", "anthropic", str(project)), "http://project"
        )
        (project / "opencode.json").unlink()
        self.assertEqual(
            self.book(opencode_dir=global_dir).address("opencode", "anthropic", str(project)),
            "http://global",
        )
        self.assertEqual(
            self.book(opencode_dir=self.root / "empty").address(
                "opencode", "openai", str(project)
            ),
            "https://api.openai.com/v1",
        )

    def test_opencode_custom_config_between_global_and_project(self):
        global_dir = self.root / "opencode"
        write_json(
            global_dir / "opencode.json",
            {"provider": {"anthropic": {"options": {"baseURL": "http://global"}}}},
        )
        custom = self.root / "custom.json"
        write_json(
            custom, {"provider": {"anthropic": {"options": {"baseURL": "http://custom"}}}}
        )
        project = self.project()
        with mock.patch.dict(os.environ, {"OPENCODE_CONFIG": str(custom)}, clear=False):
            book = self.book(opencode_dir=global_dir)
            self.assertEqual(
                book.address("opencode", "anthropic", str(project)), "http://custom"
            )
            write_json(
                project / "opencode.json",
                {"provider": {"anthropic": {"options": {"baseURL": "http://project"}}}},
            )
            self.assertEqual(
                self.book(opencode_dir=global_dir).address(
                    "opencode", "anthropic", str(project)
                ),
                "http://project",
            )

    def test_sources_do_not_share_routes(self):
        global_dir = self.root / "opencode"
        write_json(
            global_dir / "opencode.json",
            {"provider": {"anthropic": {"options": {"baseURL": "http://oc"}}}},
        )
        write_profile(self.root / "profiles", "a", "anthropic", "http://dsh")
        book = self.book(opencode_dir=global_dir)
        self.assertEqual(book.address("opencode", "anthropic"), "http://oc")
        self.assertEqual(book.address("dsh", "anthropic"), "http://dsh")
        self.assertEqual(book.address("claude", "anthropic"), "https://api.anthropic.com")

    def test_dsh_conflict_is_left_unknown(self):
        profiles = self.root / "profiles"
        write_profile(profiles, "a", "relay", "http://a")
        write_profile(profiles, "b", "relay", "http://b")
        book = self.book(profiles=profiles)
        err = io.StringIO()
        with redirect_stderr(err):
            self.assertEqual(book.address("dsh", "relay"), "")
            self.assertEqual(book.address("dsh", "relay"), "")
        self.assertIn("relay", err.getvalue())
        self.assertEqual(err.getvalue().count("多个 profile"), 1)

    def test_dsh_env_interpolation(self):
        profiles = self.root / "profiles"
        write_profile(profiles, "a", "local", "${LOCAL_API}/v1")
        with mock.patch.dict(os.environ, {"LOCAL_API": "http://127.0.0.1:9000"}, clear=False):
            book = self.book(profiles=profiles)
            self.assertEqual(book.address("dsh", "local"), "http://127.0.0.1:9000/v1")
        with mock.patch.dict(os.environ, clean_env(), clear=True):
            book = self.book(profiles=profiles)
            self.assertEqual(book.address("dsh", "local"), "")


class ZstdWarningTest(unittest.TestCase):
    def setUp(self):
        dsh_source._ZSTD_WARNED = False

    def test_missing_zstd_warns_once(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            session = root / "s1"
            session.mkdir()
            (session / "session.v4.jsonl.zstd").write_bytes(b"x")
            err = io.StringIO()
            with mock.patch("subprocess.Popen", side_effect=FileNotFoundError):
                with redirect_stderr(err):
                    self.assertEqual(dsh_source.collect(root), [])
                    self.assertEqual(dsh_source.collect(root), [])
            self.assertEqual(err.getvalue().count("zstd"), 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
