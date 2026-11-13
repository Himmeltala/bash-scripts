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

    # 直接调查询函数

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
        self.assertTrue(entries[0]["local"])

    def test_log_skip_pages(self):
        first_page = gitmod.git_log(str(self.repo), 1)
        second_page = gitmod.git_log(str(self.repo), 1, skip=1)
        self.assertEqual([e["revision"] for e in first_page], [self.second])
        self.assertEqual([e["revision"] for e in second_page], [self.first])

    def test_log_without_remote_skips_sync(self):
        # 没配远端就没有可同步的，别让日志页因此报错。
        self.assertEqual(
            gitmod.git_remote_sync(str(self.repo)),
            {
                "upstream": "",
                "fetched": False,
                "error": "",
                "branch": "main",
                "ahead": 0,
                "behind": 0,
            },
        )

    def test_revision_diff_whole_and_single_path(self):
        whole = gitmod.git_revision_diff(str(self.repo), self.first, "")
        self.assertIn("+hello", whole["text"])
        one = gitmod.git_revision_diff(str(self.repo), self.first, "sub/a.txt")
        self.assertIn("+hello", one["text"])

    def test_change_diff_full_context(self):
        with tempfile.TemporaryDirectory() as tmp:
            run(["git", "init", "-q", str(tmp)])
            lines = "".join("line %d\n" % i for i in range(1, 61))
            path = Path(tmp) / "big.txt"
            path.write_text(lines, "utf-8")
            run(["git", "add", "-A"], cwd=tmp)
            run(["git", "commit", "-qm", "init"], cwd=tmp)
            path.write_text(lines.replace("line 30\n", "line 30 changed\n"), "utf-8")
            short = gitmod.git_change_diff(tmp, "big.txt")
            full = gitmod.git_change_diff(tmp, "big.txt", full=True)
            # 默认只带改行附近三行上下文，整文件模式连第一行都带上。
            self.assertNotIn(" line 1\n", short["text"])
            self.assertIn(" line 1\n", full["text"])
            self.assertIn("+line 30 changed", full["text"])
            run(["git", "commit", "-qam", "change"], cwd=tmp)
            sha = git_out("rev-parse", "HEAD", cwd=tmp)
            rev_full = gitmod.git_revision_diff(tmp, sha, "big.txt", full=True)
            self.assertIn(" line 1\n", rev_full["text"])
            self.assertIn("+line 30 changed", rev_full["text"])

    def test_browse_lists_and_reads_files(self):
        data = gitmod.browse_list(str(self.repo), "")
        types = {e["name"]: e["type"] for e in data["entries"]}
        self.assertEqual(types.get("sub"), "dir")
        self.assertEqual(types.get("notes.txt"), "file")
        # 版本库内部目录不列出来，目录排在文件前面。
        self.assertNotIn(".git", types)
        self.assertEqual(data["entries"][0]["name"], "sub")
        self.assertEqual(gitmod.browse_file(str(self.repo), "notes.txt"), "note\n")

    def test_browse_rejects_path_outside(self):
        with self.assertRaises(gitmod.ApiError):
            gitmod.browse_list(str(self.repo), "..")
        with self.assertRaises(gitmod.ApiError):
            gitmod.browse_file(str(self.repo), "../x")

    def test_browse_search_name_and_content(self):
        by_name = gitmod.browse_search(str(self.repo), "", "NOTES", "name")
        self.assertEqual([m["path"] for m in by_name["matches"]], ["notes.txt"])
        by_content = gitmod.browse_search(str(self.repo), "", "world", "content")
        self.assertEqual(
            [(m["path"], m["line"], m["text"]) for m in by_content["matches"]],
            [("sub/a.txt", 2, "world")],
        )
        # 二进制文件不按内容搜。
        blob = self.repo / "blob.bin"
        blob.write_bytes(b"world\x00")
        try:
            again = gitmod.browse_search(str(self.repo), "", "world", "content")
            self.assertEqual([m["path"] for m in again["matches"]], ["sub/a.txt"])
        finally:
            blob.unlink()

    def test_browse_search_scoped_and_rejects_outside(self):
        hit = gitmod.browse_search(str(self.repo), "sub", "a.txt", "name")
        self.assertEqual([m["path"] for m in hit["matches"]], ["sub/a.txt"])
        with self.assertRaises(gitmod.ApiError):
            gitmod.browse_search(str(self.repo), "..", "x", "name")

    def test_browse_save_keeps_line_endings(self):
        target = self.repo / "save.txt"
        target.write_bytes(b"a\r\nb\r\n")
        try:
            data = gitmod.save_file(str(self.repo), "save.txt", "x\ny\n")
            self.assertEqual(data["size"], len(b"x\r\ny\r\n"))
            self.assertEqual(target.read_bytes(), b"x\r\ny\r\n")
        finally:
            target.unlink()
        with self.assertRaises(gitmod.ApiError):
            gitmod.save_file(str(self.repo), "../x", "x")
        with self.assertRaises(gitmod.ApiError):
            gitmod.save_file(str(self.repo), "sub", "x")

    def test_alias_and_relative_path_in_state(self):
        wid = self.add()
        status, data = self.call("/alias", {"ws": wid, "alias": "  我的   仓库 "})
        self.assertEqual(status, 200, data)

        status, data = self.call("/state")
        item = next(w for w in data["workspaces"] if w["id"] == wid)
        self.assertEqual(item["alias"], "我的 仓库")
        self.assertEqual(
            item["rel"],
            os.path.relpath(str(self.repo.resolve()), os.path.expanduser("~")),
        )

        status, data = self.call("/alias", {"ws": wid, "alias": ""})
        self.assertEqual(status, 200, data)
        status, data = self.call("/state")
        item = next(w for w in data["workspaces"] if w["id"] == wid)
        self.assertEqual(item["alias"], "")
        self.call("/forget", {"ws": wid})

    def test_write_guard_only_trusts_loopback(self):
        self.assertTrue(gitmod.is_loopback("127.0.0.1"))
        self.assertTrue(gitmod.is_loopback("::1"))
        self.assertTrue(gitmod.is_loopback("::ffff:127.0.0.1"))
        self.assertFalse(gitmod.is_loopback("192.168.1.20"))
        self.assertFalse(gitmod.is_loopback("::ffff:192.168.1.20"))

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

    # 接口

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

        status, data = self.call("/diff?ws=%s&path=sub/a.txt&item=modified&full=1" % wid)
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
        self.assertEqual(data["remote"]["upstream"], "")

        status, data = self.call("/revision?ws=%s&rev=%s" % (wid, self.first))
        self.assertEqual(status, 200, data)
        self.assertIn("+hello", data["text"])

        status, data = self.call(
            "/revision?ws=%s&rev=%s&path=sub/a.txt" % (wid, self.first)
        )
        self.assertEqual(status, 200, data)
        self.assertIn("+hello", data["text"])

        status, data = self.call(
            "/revision?ws=%s&rev=%s&path=sub/a.txt&full=1" % (wid, self.first)
        )
        self.assertEqual(status, 200, data)
        self.assertIn("+hello", data["text"])
        self.call("/forget", {"ws": wid})

    def test_api_tree_and_file(self):
        wid = self.add()
        status, data = self.call("/tree?ws=" + wid)
        self.assertEqual(status, 200, data)
        self.assertIn("sub", [e["name"] for e in data["entries"]])

        status, data = self.call("/tree?ws=%s&path=sub" % wid)
        self.assertEqual(status, 200, data)
        self.assertIn("a.txt", [e["name"] for e in data["entries"]])

        status, data = self.call("/file?ws=%s&path=sub/untracked.txt" % wid)
        self.assertEqual(status, 200, data)
        self.assertEqual(data["text"], "new\n")

        status, data = self.call("/file?ws=%s&path=../x" % wid)
        self.assertEqual(status, 400)

        status, data = self.call("/search?ws=%s&q=world&mode=content" % wid)
        self.assertEqual(status, 200, data)
        self.assertEqual([(m["path"], m["line"]) for m in data["matches"]], [("sub/a.txt", 2)])

        status, data = self.call("/search?ws=%s&q=notes&mode=name" % wid)
        self.assertEqual(status, 200, data)
        self.assertEqual([m["path"] for m in data["matches"]], ["notes.txt"])
        self.call("/forget", {"ws": wid})

    def test_api_save_file(self):
        wid = self.add()
        target = self.repo / "sub" / "save.txt"
        target.write_text("old\n", "utf-8")
        try:
            status, data = self.call(
                "/save", {"ws": wid, "path": "sub/save.txt", "text": "new\nline\n"}
            )
            self.assertEqual(status, 200, data)
            self.assertEqual(target.read_text("utf-8"), "new\nline\n")

            status, data = self.call("/save", {"ws": wid, "path": "../x", "text": "x"})
            self.assertEqual(status, 400)
            status, data = self.call("/save", {"ws": wid, "path": "sub", "text": "x"})
            self.assertEqual(status, 400)
        finally:
            target.unlink()
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


class GitRemoteLog(unittest.TestCase):
    """有远端时取日志先同步：别人刚推的提交要列出来，并标成远程。"""

    def test_log_syncs_remote_and_marks_entry(self):
        with tempfile.TemporaryDirectory(prefix="dvcsx-git-remote-") as tmp:
            base = Path(tmp)
            src = base / "src"
            run(["git", "init", "-q", "-b", "main", str(src)])
            (src / "a.txt").write_text("a\n", "utf-8")
            run(["git", "add", "a.txt"], cwd=src)
            run(["git", "commit", "-qm", "base"], cwd=src)
            bare = base / "origin.git"
            run(["git", "clone", "-q", "--bare", str(src), str(bare)])

            work = base / "work"
            run(["git", "clone", "-q", str(bare), str(work)])
            other = base / "other"
            run(["git", "clone", "-q", str(bare), str(other)])
            (other / "b.txt").write_text("b\n", "utf-8")
            run(["git", "add", "b.txt"], cwd=other)
            run(["git", "commit", "-qm", "远端新提交"], cwd=other)
            run(["git", "push", "-q", "origin", "main"], cwd=other)

            # 同步前，本地记录到的远端还停在 base。
            before = [e["message"] for e in gitmod.git_log(str(work), 5, "origin/main")]
            self.assertEqual(before, ["base"])

            meta = gitmod.git_remote_sync(str(work))
            self.assertTrue(meta["fetched"], meta)
            self.assertEqual(meta["upstream"], "origin/main")
            self.assertEqual((meta["branch"], meta["ahead"], meta["behind"]), ("main", 0, 1))

            entries = gitmod.git_log(str(work), 5, meta["upstream"])
            by_msg = {e["message"]: e for e in entries}
            self.assertFalse(by_msg["远端新提交"]["local"])
            self.assertTrue(by_msg["base"]["local"])
            # 只在远端的那条标成远端跟踪分支的最新提交，本地那条是 HEAD。
            self.assertTrue(by_msg["远端新提交"]["remote_tip"])
            self.assertTrue(by_msg["远端新提交"]["pushed"])
            self.assertTrue(by_msg["base"]["head"])
            self.assertFalse(by_msg["base"]["remote_tip"])

            # 同步只动远端跟踪分支，工作区与暂存区保持原样。
            self.assertEqual(git_out("status", "--porcelain", cwd=work), "")


class GitOperations(unittest.TestCase):
    """克隆出来的仓库：拉取、推送、提交详情与同步信息。"""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="dvcsx-git-op-")
        base = Path(self.tmp.name)
        src = base / "src"
        run(["git", "init", "-q", "-b", "main", str(src)])
        (src / "a.txt").write_text("a\n", "utf-8")
        run(["git", "add", "a.txt"], cwd=src)
        run(["git", "commit", "-qm", "base"], cwd=src)
        self.bare = base / "origin.git"
        run(["git", "clone", "-q", "--bare", str(src), str(self.bare)])
        self.work = base / "work"
        run(["git", "clone", "-q", str(self.bare), str(self.work)])
        self.other = base / "other"
        run(["git", "clone", "-q", str(self.bare), str(self.other)])

    def tearDown(self):
        self.tmp.cleanup()

    def remote_commit(self):
        (self.other / "b.txt").write_text("b\n", "utf-8")
        run(["git", "add", "b.txt"], cwd=self.other)
        run(["git", "commit", "-qm", "远端新提交"], cwd=self.other)
        run(["git", "push", "-q", "origin", "main"], cwd=self.other)

    def test_pull_fast_forward(self):
        self.remote_commit()
        result = gitmod.git_pull(str(self.work), "ff")
        self.assertTrue(result["ok"], result)
        self.assertIn("远端新提交", git_out("log", "-1", "--format=%s", cwd=self.work))
        self.assertTrue((self.work / "b.txt").is_file())

    def test_pull_rejects_unknown_mode(self):
        with self.assertRaises(gitmod.ApiError):
            gitmod.git_pull(str(self.work), "whatever")

    def test_push_updates_remote(self):
        (self.work / "c.txt").write_text("c\n", "utf-8")
        run(["git", "add", "c.txt"], cwd=self.work)
        run(["git", "commit", "-qm", "本地提交"], cwd=self.work)
        result = gitmod.git_push(str(self.work))
        self.assertTrue(result["ok"], result)
        self.assertEqual(
            git_out("rev-parse", "HEAD", cwd=self.work),
            git_out("rev-parse", "main", cwd=self.bare),
        )

    def test_push_without_upstream_can_set_it(self):
        # 去掉跟踪关系但保留同名远端，模拟“刚加 remote、还没设上游”的仓库。
        run(["git", "remote", "remove", "origin"], cwd=self.work)
        run(["git", "remote", "add", "origin", str(self.bare)], cwd=self.work)
        with self.assertRaises(gitmod.ApiError):
            gitmod.git_push(str(self.work))
        result = gitmod.git_push(str(self.work), set_upstream=True)
        self.assertTrue(result["ok"], result)
        self.assertEqual(git_out("rev-parse", "--abbrev-ref", "@{upstream}", cwd=self.work), "origin/main")

    def test_commit_detail_keeps_full_message(self):
        run(["git", "commit", "--allow-empty", "-qm", "标题\n\n正文第一行\n正文第二行"], cwd=self.work)
        sha = git_out("rev-parse", "HEAD", cwd=self.work)
        detail = gitmod.git_commit_detail(str(self.work), sha)
        self.assertEqual(detail["revision"], sha)
        self.assertEqual(detail["message"], "标题\n\n正文第一行\n正文第二行")
        self.assertEqual(len(detail["parents"]), 1)

    def test_commit_covers_modified_and_untracked(self):
        (self.work / "a.txt").write_text("a\nchanged\n", "utf-8")
        (self.work / "b.txt").write_text("b\n", "utf-8")
        plan = gitmod.operation_plan(
            {"id": "x", "root": str(self.work), "vcs": "git"},
            {"action": "commit", "message": "两处改动", "paths": ["a.txt", "b.txt"]},
        )
        self.assertEqual(len(plan["commands"]), 2)
        for argv in plan["commands"]:
            run(argv, cwd=plan["cwd"])
        self.assertEqual(git_out("log", "-1", "--format=%s", cwd=self.work), "两处改动")
        self.assertEqual(git_out("status", "--porcelain", cwd=self.work), "")

    def test_commit_handles_rename(self):
        run(["git", "mv", "a.txt", "c.txt"], cwd=self.work)
        plan = gitmod.operation_plan(
            {"id": "x", "root": str(self.work), "vcs": "git"},
            {"action": "commit", "message": "改名", "paths": ["c.txt"]},
        )
        for argv in plan["commands"]:
            run(argv, cwd=plan["cwd"])
        self.assertEqual(git_out("status", "--porcelain", cwd=self.work), "")
        shown = git_out("show", "--name-status", "--format=", "HEAD", cwd=self.work)
        self.assertIn("c.txt", shown)
        self.assertIn("a.txt", shown)

    def test_commit_refuses_unselected_staged_path(self):
        (self.work / "a.txt").write_text("a\nchanged\n", "utf-8")
        (self.work / "b.txt").write_text("b\n", "utf-8")
        run(["git", "add", "b.txt"], cwd=self.work)
        with self.assertRaises(gitmod.ApiError):
            gitmod.operation_plan(
                {"id": "x", "root": str(self.work), "vcs": "git"},
                {"action": "commit", "message": "只提交 a", "paths": ["a.txt"]},
            )

    def test_sync_info_lists_changes(self):
        (self.work / "a.txt").write_text("a\nchanged\n", "utf-8")
        (self.work / "b.txt").write_text("b\n", "utf-8")
        info = gitmod.git_sync_info(str(self.work))
        items = {item["path"]: item["item"] for item in info["files"]}
        self.assertEqual(items.get("a.txt"), "modified")
        self.assertEqual(items.get("b.txt"), "unversioned")

    def test_sync_info_reports_upstream(self):
        info = gitmod.git_sync_info(str(self.work))
        self.assertEqual(info["branch"], "main")
        self.assertEqual(info["upstream"], "origin/main")
        self.assertEqual(info["remotes"], ["origin"])
        self.assertFalse(info["detached"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
