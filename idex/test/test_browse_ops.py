#!/usr/bin/env python3
"""浏览目录的增删改：新建、改名、删除，已纳管的要走 svn 与 git，未纳管的直接动磁盘。"""

import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
SERVER = HERE.parent / "lib" / "idex" / "web" / "server.py"

sys.path.insert(0, str(HERE.parent.parent / "lib" / "py-shared" / "commons"))
sys.path.insert(0, str(HERE.parent.parent / "lib" / "py-shared" / "services"))
from testkit import json_call, load_module, serve

web = load_module("idex_browse_ops", SERVER)

ENV = dict(
    os.environ,
    GIT_AUTHOR_NAME="Alice",
    GIT_AUTHOR_EMAIL="a@example.com",
    GIT_COMMITTER_NAME="Alice",
    GIT_COMMITTER_EMAIL="a@example.com",
)


def run(args, cwd=None):
    cp = subprocess.run(args, cwd=cwd, capture_output=True, text=True, env=ENV)
    if cp.returncode != 0:
        raise RuntimeError("%s 失败：%s" % (" ".join(args), cp.stderr.strip()))
    return cp.stdout


def open_ws(base, root):
    """起一个临时服务并把它下面的目录登记成工作区，返回 (server, 工作区 id)。"""
    store = web.Workspaces(Path(base) / "state.json")
    item = store.add(str(root))
    handler = type(
        "BrowseOpsHandler",
        (web.Handler,),
        {"store": store, "groups": web.LayoutStore(Path(base) / "groups.json")},
    )
    server = serve(handler, static=base, api_prefix="/api")
    return server, item["id"]


class PlainDirOps(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name) / "root"
        self.root.mkdir()
        (self.root / "a.txt").write_text("a\n", "utf-8")
        self.server, self.ws = open_ws(self.tmp.name, self.root)
        self.base = self.server.base

    def tearDown(self):
        self.server.shutdown()
        self.tmp.cleanup()

    def call(self, route, body):
        return json_call(self.base, route, {"ws": self.ws, **body})

    def test_create_dir_and_file(self):
        status, data = self.call("/mkdir", {"dir": "", "name": "新目录"})
        self.assertEqual(status, 200, data)
        self.assertEqual(data["path"], "新目录")
        self.assertEqual(data["type"], "dir")
        self.assertTrue((self.root / "新目录").is_dir())

        status, data = self.call("/newfile", {"dir": "新目录", "name": "说明.md"})
        self.assertEqual(status, 200, data)
        self.assertEqual(data["path"], "新目录/说明.md")
        self.assertEqual((self.root / "新目录" / "说明.md").read_text("utf-8"), "")

    def test_create_rejects_bad_or_existing_names(self):
        for name in ("", ".", "..", "a/b", "a\\b"):
            status, data = self.call("/mkdir", {"dir": "", "name": name})
            self.assertEqual(status, 400, name)
        status, data = self.call("/newfile", {"dir": "", "name": "a.txt"})
        self.assertEqual(status, 409, data)
        self.assertEqual((self.root / "a.txt").read_text("utf-8"), "a\n")

    def test_rename_then_delete(self):
        status, data = self.call("/rename", {"path": "a.txt", "name": "b.txt"})
        self.assertEqual(status, 200, data)
        self.assertEqual(data["path"], "b.txt")
        self.assertFalse((self.root / "a.txt").exists())
        self.assertEqual((self.root / "b.txt").read_text("utf-8"), "a\n")

        status, data = self.call("/delete", {"path": "b.txt"})
        self.assertEqual(status, 200, data)
        self.assertFalse((self.root / "b.txt").exists())

    def test_rename_rejects_existing_target(self):
        (self.root / "b.txt").write_text("b\n", "utf-8")
        status, data = self.call("/rename", {"path": "a.txt", "name": "b.txt"})
        self.assertEqual(status, 409, data)
        self.assertTrue((self.root / "a.txt").exists())

    def test_delete_dir_removes_contents(self):
        (self.root / "d").mkdir()
        (self.root / "d" / "x.txt").write_text("x\n", "utf-8")
        status, data = self.call("/delete", {"path": "d"})
        self.assertEqual(status, 200, data)
        self.assertFalse((self.root / "d").exists())

    def test_refuses_root_and_missing_targets(self):
        status, _ = self.call("/delete", {"path": ""})
        self.assertEqual(status, 400)
        status, _ = self.call("/rename", {"path": "", "name": "x"})
        self.assertEqual(status, 400)
        status, _ = self.call("/newfile", {"dir": "nope", "name": "x"})
        self.assertEqual(status, 404)


@unittest.skipUnless(shutil.which("git"), "没装 git")
class GitOps(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        base = Path(self.tmp.name)
        self.repo = base / "repo"
        run(["git", "init", "-q", "-b", "main", str(self.repo)])
        (self.repo / "a.txt").write_text("a\n", "utf-8")
        (self.repo / "d").mkdir()
        (self.repo / "d" / "x.txt").write_text("x\n", "utf-8")
        run(["git", "add", "-A"], cwd=self.repo)
        run(["git", "commit", "-qm", "init"], cwd=self.repo)
        (self.repo / "u.txt").write_text("u\n", "utf-8")
        (self.repo / "d" / "untracked.txt").write_text("n\n", "utf-8")
        self.server, self.ws = open_ws(self.tmp.name, self.repo)
        self.base = self.server.base

    def tearDown(self):
        self.server.shutdown()
        self.tmp.cleanup()

    def call(self, route, body):
        return json_call(self.base, route, {"ws": self.ws, **body})

    def status(self):
        return run(["git", "status", "--porcelain"], cwd=self.repo)

    def test_rename_tracked_uses_git_mv(self):
        status, data = self.call("/rename", {"path": "a.txt", "name": "b.txt"})
        self.assertEqual(status, 200, data)
        self.assertIn("R  a.txt -> b.txt", self.status())

    def test_rename_untracked_stays_untracked(self):
        status, data = self.call("/rename", {"path": "u.txt", "name": "v.txt"})
        self.assertEqual(status, 200, data)
        self.assertTrue((self.repo / "v.txt").exists())
        self.assertIn("?? v.txt", self.status())

    def test_delete_tracked_file_stages_removal(self):
        status, data = self.call("/delete", {"path": "a.txt"})
        self.assertEqual(status, 200, data)
        self.assertFalse((self.repo / "a.txt").exists())
        self.assertIn("D  a.txt", self.status())

    def test_delete_dir_takes_tracked_and_untracked(self):
        status, data = self.call("/delete", {"path": "d"})
        self.assertEqual(status, 200, data)
        self.assertFalse((self.repo / "d").exists())
        self.assertIn("D  d/x.txt", self.status())

    def test_new_file_is_not_added(self):
        status, data = self.call("/newfile", {"dir": "", "name": "n.md"})
        self.assertEqual(status, 200, data)
        self.assertIn("?? n.md", self.status())


@unittest.skipUnless(shutil.which("svn") and shutil.which("svnadmin"), "没装 svn")
class SvnOps(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        base = Path(self.tmp.name)
        self.repo = base / "repo"
        self.wc = base / "wc"
        run(["svnadmin", "create", str(self.repo)])
        self.url = "file://" + str(self.repo)
        run(["svn", "checkout", "-q", self.url, str(self.wc)])
        (self.wc / "a.txt").write_text("a\n", "utf-8")
        (self.wc / "d").mkdir()
        (self.wc / "d" / "x.txt").write_text("x\n", "utf-8")
        run(["svn", "add", "-q", "a.txt", "d"], cwd=self.wc)
        run(["svn", "commit", "-q", "-m", "init", "."], cwd=self.wc)
        (self.wc / "d" / "untracked.txt").write_text("n\n", "utf-8")
        self.server, self.ws = open_ws(self.tmp.name, self.wc)
        self.base = self.server.base

    def tearDown(self):
        self.server.shutdown()
        self.tmp.cleanup()

    def call(self, route, body):
        return json_call(self.base, route, {"ws": self.ws, **body})

    def status(self):
        return run(["svn", "status"], cwd=self.wc)

    def test_rename_tracked_uses_svn_mv(self):
        status, data = self.call("/rename", {"path": "a.txt", "name": "b.txt"})
        self.assertEqual(status, 200, data)
        self.assertFalse((self.wc / "a.txt").exists())
        self.assertTrue((self.wc / "b.txt").is_file())
        # svn mv 在 status 里表现为删一个、加一个带历史的，靠这两行确认历史跟过去了。
        text = self.status()
        self.assertIn("D       a.txt", text)
        self.assertIn("> moved from a.txt", text)

    def test_delete_tracked_uses_svn_rm(self):
        status, data = self.call("/delete", {"path": "a.txt"})
        self.assertEqual(status, 200, data)
        self.assertFalse((self.wc / "a.txt").exists())
        self.assertIn("D       a.txt", self.status())

    def test_delete_dir_takes_untracked_too(self):
        status, data = self.call("/delete", {"path": "d"})
        self.assertEqual(status, 200, data)
        self.assertFalse((self.wc / "d").exists())

    def test_new_file_stays_unversioned(self):
        status, data = self.call("/newfile", {"dir": "", "name": "n.md"})
        self.assertEqual(status, 200, data)
        self.assertIn("?       n.md", self.status())


if __name__ == "__main__":
    unittest.main(verbosity=2)
