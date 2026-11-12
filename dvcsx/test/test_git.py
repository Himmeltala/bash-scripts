#!/usr/bin/env python3
"""dvcsx 回归：临时 Git 仓库上的状态解析、差异、日志与网页接口。"""

import importlib.util
import json
import os
import subprocess
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
SERVER_PY = HERE.parent / "lib" / "dvcsx" / "web" / "server.py"


def load_server():
    spec = importlib.util.spec_from_file_location("dvcsx_server", SERVER_PY)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


gitmod = load_server()

# 临时仓库里的提交要作者信息，本机的全局配置不一定有。
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


def git_out(*args, cwd):
    return run(["git", *args], cwd=cwd).strip()


class GitWorkspace(unittest.TestCase):
    """两次提交的仓库：sub/a.txt 改动过、old.txt 重命名成 new.txt、还有一个未跟踪文件。"""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory(prefix="dvcsx-git-test-")
        base = Path(cls.tmp.name)
        cls.repo = base / "repo"
        cls.static = base / "static"
        cls.static.mkdir()
        (cls.static / "index.html").write_text("<html></html>", "utf-8")

        run(["git", "init", "-q", "-b", "main", str(cls.repo)])
        (cls.repo / "sub").mkdir()
        (cls.repo / "sub" / "a.txt").write_text("hello\n", "utf-8")
        (cls.repo / "old.txt").write_text("old\n", "utf-8")
        run(["git", "add", "-A"], cwd=cls.repo)
        run(["git", "commit", "-qm", "first"], cwd=cls.repo)
        cls.first = git_out("rev-parse", "HEAD", cwd=cls.repo)

        (cls.repo / "notes.txt").write_text("note\n", "utf-8")
        run(["git", "add", "notes.txt"], cwd=cls.repo)
        run(["git", "commit", "-qm", "second"], cwd=cls.repo)
        cls.second = git_out("rev-parse", "HEAD", cwd=cls.repo)

        # 工作区里：改一个已跟踪文件并暂存、重命名一个文件、留一个未跟踪文件。
        (cls.repo / "sub" / "a.txt").write_text("hello\nworld\n", "utf-8")
        run(["git", "add", "sub/a.txt"], cwd=cls.repo)
        run(["git", "mv", "old.txt", "new.txt"], cwd=cls.repo)
        (cls.repo / "sub" / "untracked.txt").write_text("new\n", "utf-8")

        cls.handler = gitmod.Handler
        cls.handler.static = cls.static.resolve()
        cls.handler.store = gitmod.Workspaces(str(base / "state.json"))
        cls.handler.api_prefix = "/__dvcsx/api"
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), cls.handler)
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()
        cls.base = "http://127.0.0.1:%d/__dvcsx/api" % cls.httpd.server_address[1]

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        cls.tmp.cleanup()

    def call(self, path, body=None):
        data = json.dumps(body).encode("utf-8") if body is not None else None
        headers = {"Content-Type": "application/json"} if data else {}
        req = urllib.request.Request(self.base + path, data=data, headers=headers)
        try:
            with urllib.request.urlopen(req) as resp:
                return resp.status, json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            return exc.code, json.loads(exc.read().decode("utf-8"))

    def add(self):
        status, data = self.call("/workspaces", {"root": str(self.repo)})
        self.assertEqual(status, 200, data)
        return data["workspace"]["id"]

    # ---- 直接调查询函数

    def test_info_reads_repo(self):
        info = gitmod.git_info(str(self.repo))
        self.assertEqual(info["top"], str(self.repo.resolve()))
        self.assertEqual(info["branch"], "main")
        self.assertEqual(len(info["revision"]), 7)
        self.assertEqual(info["url"], "")

    def test_detect_reads_git_repo(self):
        vcs, info = gitmod.detect_vcs(str(self.repo))
        self.assertEqual(vcs, "git")
        self.assertEqual(info["top"], str(self.repo.resolve()))

    def test_status_lists_changes(self):
        data = gitmod.git_changes(str(self.repo))
        items = {f["path"]: f["item"] for f in data["files"]}
        self.assertEqual(items.get("sub/a.txt"), "modified")
        self.assertEqual(items.get("new.txt"), "renamed")
        self.assertEqual(items.get("sub/untracked.txt"), "unversioned")
        self.assertFalse(data["truncated"])

    def test_diff_includes_staged_change(self):
        result = gitmod.git_change_diff(str(self.repo), "sub/a.txt")
        self.assertIn("+world", result["text"])

    def test_unversioned_file_reads_as_content(self):
        top = gitmod.workspace_paths({"root": str(self.repo), "vcs": "git"})
        self.assertEqual(gitmod.read_unversioned(top, "sub/untracked.txt"), "new\n")

    def test_safe_rel_rejects_path_outside(self):
        with self.assertRaises(gitmod.ApiError):
            gitmod.safe_rel("../etc/passwd")

    def test_log_returns_commit(self):
        entries = gitmod.git_log(str(self.repo), 5)
        self.assertEqual(entries[0]["revision"], self.second)
        self.assertEqual(entries[0]["message"], "second")
        self.assertIn("notes.txt", [p["path"] for p in entries[0]["paths"]])
        self.assertEqual(len(entries[0]["short"]), 7)

    def test_revision_diff_whole_and_single_path(self):
        whole = gitmod.git_revision_diff(str(self.repo), self.first, "")
        self.assertIn("+hello", whole["text"])
        one = gitmod.git_revision_diff(str(self.repo), self.first, "sub/a.txt")
        self.assertIn("+hello", one["text"])

    def test_old_state_defaults_to_svn(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "state.json"
            path.write_text(
                json.dumps({"workspaces": [{"id": "abc", "root": "/x", "url": ""}]}),
                "utf-8",
            )
            items = gitmod.Workspaces(str(path)).workspaces()
            self.assertEqual(items[0]["vcs"], "svn")

    def test_empty_repo_has_no_log(self):
        with tempfile.TemporaryDirectory() as tmp:
            run(["git", "init", "-q", str(tmp)])
            self.assertEqual(gitmod.git_log(tmp, 5), [])
            (Path(tmp) / "x.txt").write_text("x\n", "utf-8")
            data = gitmod.git_changes(tmp)
            self.assertEqual([f["item"] for f in data["files"]], ["unversioned"])

    # ---- 接口

    def test_api_add_state_forget(self):
        wid = self.add()
        status, data = self.call("/state")
        self.assertEqual(status, 200)
        item = [w for w in data["workspaces"] if w["id"] == wid][0]
        self.assertEqual(item["vcs"], "git")
        status, data = self.call("/forget", {"ws": wid})
        self.assertEqual(status, 200, data)
        status, data = self.call("/state")
        self.assertNotIn(wid, [w["id"] for w in data["workspaces"]])

    def test_api_changes_and_diffs(self):
        wid = self.add()
        status, data = self.call("/changes?ws=" + wid)
        self.assertEqual(status, 200, data)
        self.assertEqual(data["info"]["branch"], "main")
        items = {f["path"]: f["item"] for f in data["files"]}
        self.assertEqual(items.get("sub/a.txt"), "modified")

        status, data = self.call("/diff?ws=%s&path=sub/a.txt&item=modified" % wid)
        self.assertEqual(status, 200, data)
        self.assertIn("+world", data["text"])

        status, data = self.call("/diff?ws=%s&path=sub/untracked.txt&item=unversioned" % wid)
        self.assertEqual(status, 200, data)
        self.assertEqual(data["kind"], "file")
        self.assertIn("new", data["text"])

        status, data = self.call("/diff?ws=%s&path=../x&item=modified" % wid)
        self.assertEqual(status, 400)
        self.call("/forget", {"ws": wid})

    def test_api_log_and_revision(self):
        wid = self.add()
        status, data = self.call("/log?ws=%s&limit=5" % wid)
        self.assertEqual(status, 200, data)
        self.assertEqual(data["entries"][0]["revision"], self.second)

        status, data = self.call("/revision?ws=%s&rev=%s" % (wid, self.first))
        self.assertEqual(status, 200, data)
        self.assertIn("+hello", data["text"])

        status, data = self.call(
            "/revision?ws=%s&rev=%s&path=sub/a.txt" % (wid, self.first)
        )
        self.assertEqual(status, 200, data)
        self.assertIn("+hello", data["text"])
        self.call("/forget", {"ws": wid})

    def test_api_rejects_foreign_dir(self):
        # 仓库之外的临时目录既不在 SVN 里，也不在 Git 里，加不进来。
        with tempfile.TemporaryDirectory() as tmp:
            status, data = self.call("/workspaces", {"root": tmp})
        self.assertEqual(status, 400)
        self.assertIn("Git", data["error"])

    def test_api_serves_static_page(self):
        with urllib.request.urlopen(self.base.rsplit("/__dvcsx/api", 1)[0] + "/") as resp:
            self.assertEqual(resp.status, 200)
            self.assertIn(b"<html>", resp.read())


if __name__ == "__main__":
    unittest.main(verbosity=2)
