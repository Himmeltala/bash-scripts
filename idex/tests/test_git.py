#!/usr/bin/env python3
# @Author: Himmeltala
# @Date: 2026-11-26 09:29:54
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-26 09:29:54
# @FilePath: \idex\tests\test_git.py
# @Description: idex 回归：临时 Git 仓库上的状态解析、差异、日志与网页接口。

"""idex 回归：临时 Git 仓库上的状态解析、差异、日志与网页接口。"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
SERVER_PY = HERE.parent / "src" / "idex" / "web" / "server.py"

# 测试按 python3 -I 跑，共享层不在 sys.path 上，显式加进去。
sys.path.insert(0, str(HERE.parent.parent / "lib" / "py-shared" / "commons"))
sys.path.insert(0, str(HERE.parent.parent / "lib" / "py-shared" / "services"))
from testkit import json_call, load_module, serve

gitmod = load_module("idex_server", SERVER_PY)
WEB = HERE.parent / "src" / "idex" / "web"
sys.path.insert(0, str(WEB))
# 重构后函数分散到各模块；用例仍从一个命名空间取，测试侧合并，产品代码不加重导出。
for _name in ("browse_fs", "git_query", "vcs_ops", "vcs_summary", "server_common", "server_stores", "vcs_common"):
    _mod = load_module("idex_" + _name, WEB / (_name + ".py"))
    for _key, _value in vars(_mod).items():
        if not _key.startswith("_") and not hasattr(gitmod, _key):
            setattr(gitmod, _key, _value)
hunksmod = load_module("idex_vcs_hunks", WEB / "vcs_hunks.py")

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


def make_conflict(repo):
    """a.txt 在 main 与 side 各改一行，合并留下 UU 冲突；仓库里还没有 a.txt 时先建一个。"""
    if not (repo / "a.txt").exists():
        (repo / "a.txt").write_text("base\n", "utf-8")
    run(["git", "add", "a.txt"], cwd=repo)
    subprocess.run(["git", "commit", "-qm", "pre"], cwd=repo, capture_output=True, env=ENV)
    run(["git", "checkout", "-q", "-b", "side"], cwd=repo)
    (repo / "a.txt").write_text("base\nside\n", "utf-8")
    run(["git", "commit", "-qam", "side"], cwd=repo)
    run(["git", "checkout", "-q", "main"], cwd=repo)
    (repo / "a.txt").write_text("base\nmain\n", "utf-8")
    run(["git", "commit", "-qam", "main"], cwd=repo)
    subprocess.run(["git", "merge", "side"], cwd=repo, capture_output=True, env=ENV)


class GitWorkspace(unittest.TestCase):
    """两次提交的仓库：sub/a.txt 改动过、old.txt 重命名成 new.txt、还有一个未跟踪文件。"""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory(prefix="idex-git-test-")
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

        cls.server = serve(
            gitmod.Handler,
            static=cls.static.resolve(),
            api_prefix="/__idex/api",
            store=gitmod.Workspaces(str(base / "state.json")),
            settings=gitmod.Settings(str(base / "settings.json")),
        )
        cls.base = cls.server.base

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.tmp.cleanup()

    def call(self, path, body=None):
        return json_call(self.base, path, body)

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

    def test_changes_signature_tracks_head(self):
        # 指纹之外的版本也要给出来：外面提交后页面能据此重读日志与同步信息。
        _, _, revision = gitmod.changes_signature(
            {"id": "w", "root": str(self.repo), "vcs": "git"}
        )
        self.assertEqual(revision, self.second)

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

    def test_diff_marks_long_line_as_wide(self):
        with tempfile.TemporaryDirectory() as tmp:
            run(["git", "init", "-q", tmp])
            path = Path(tmp) / "wide.txt"
            path.write_text("y" * 3000 + "\n", "utf-8")
            run(["git", "add", "-A"], cwd=tmp)
            self.assertTrue(gitmod.git_change_diff(tmp, "wide.txt")["wide"])
            # 差异行前的 + 标记不算进宽度：正好 2000 不算长，2001 才算。
            path.write_text("y" * 2000 + "\n", "utf-8")
            run(["git", "add", "-A"], cwd=tmp)
            self.assertFalse(gitmod.git_change_diff(tmp, "wide.txt")["wide"])
            path.write_text("y" * 2001 + "\n", "utf-8")
            run(["git", "add", "-A"], cwd=tmp)
            self.assertTrue(gitmod.git_change_diff(tmp, "wide.txt")["wide"])

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
        self.assertEqual(entries[0]["parents"], [self.first])
        # 列表不再带路径，路径随选中提交的详情一起取。
        self.assertEqual(entries[0]["paths"], [])
        detail = gitmod.git_commit_detail(str(self.repo), self.second)
        self.assertIn("notes.txt", [p["path"] for p in detail["paths"]])
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
        # 目录不过滤，版本库内部目录也照实列出，目录仍排在文件前面。
        self.assertEqual(types.get(".git"), "dir")
        kinds = [e["type"] for e in data["entries"]]
        self.assertEqual(kinds, sorted(kinds, key=lambda kind: kind != "dir"))
        self.assertEqual(gitmod.browse_file(str(self.repo), "notes.txt"), "note\n")

    def test_browse_shows_build_and_dependency_dirs(self):
        made = ["dist", "build", "target", "node_modules"]
        try:
            for name in made:
                (self.repo / name).mkdir()
                (self.repo / name / "x.txt").write_text("x\n", "utf-8")
            names = [e["name"] for e in gitmod.browse_list(str(self.repo), "")["entries"]]
            self.assertEqual([name for name in names if name in made], sorted(made))
            hits = gitmod.browse_search(str(self.repo), "", "x.txt", "name")["matches"]
            self.assertIn("dist/x.txt", [m["path"] for m in hits])
        finally:
            for name in made:
                shutil.rmtree(self.repo / name)

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

    def test_browse_search_name_ignores_directories(self):
        # 目录名不参与文件名搜索：sub 下面有文件，但没有哪个文件叫 sub。
        hits = gitmod.browse_search(str(self.repo), "", "sub", "name")
        self.assertEqual([m["path"] for m in hits["matches"]], [])
        hits = gitmod.browse_search(str(self.repo), "", "a.txt", "name")
        self.assertEqual([m["path"] for m in hits["matches"]], ["sub/a.txt"])

    def test_browse_search_scoped_and_rejects_outside(self):
        hit = gitmod.browse_search(str(self.repo), "sub", "a.txt", "name")
        self.assertEqual([m["path"] for m in hit["matches"]], ["sub/a.txt"])
        with self.assertRaises(gitmod.ApiError):
            gitmod.browse_search(str(self.repo), "..", "x", "name")

    def test_browse_search_skips_ignored_dirs(self):
        made = ["node_modules", "dist"]
        try:
            for name in made:
                (self.repo / name).mkdir()
                (self.repo / name / "hit.txt").write_text("x\n", "utf-8")
            hits = gitmod.browse_search(str(self.repo), "", "hit.txt", "name")
            self.assertEqual([m["path"] for m in hits["matches"]],
                             ["dist/hit.txt", "node_modules/hit.txt"])
            # 按名字在任何一层匹配；只跳过的目录不往里走。
            hits = gitmod.browse_search(str(self.repo), "", "hit.txt", "name",
                                        ["node_modules"])
            self.assertEqual([m["path"] for m in hits["matches"]], ["dist/hit.txt"])
        finally:
            for name in made:
                shutil.rmtree(self.repo / name)

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

    def test_hunks_parse_and_find(self):
        text = (
            "diff --git a/x.txt b/x.txt\n"
            "--- a/x.txt\n"
            "+++ b/x.txt\n"
            "@@ -1,3 +1,3 @@ title\n"
            " one\n"
            "-two\n"
            "+TWO\n"
            " three\n"
            "@@ -9,2 +9,3 @@\n"
            " nine\n"
            "+ten\n"
            " eleven\n"
        )
        hunks = hunksmod.parse_hunks(text)
        self.assertEqual(len(hunks), 2)
        self.assertEqual(hunks[0]["old_start"], 1)
        self.assertEqual(hunks[1]["new_lines"], 3)
        self.assertEqual(hunksmod.find_hunk(text, hunks[1]["text"]), hunks[1])
        self.assertIsNone(hunksmod.find_hunk(text, "@@ -1,1 +1,1 @@\n-x\n+y\n"))
        self.assertEqual(
            hunksmod.reverse_patch("x.txt", hunks[0]).splitlines()[0], "--- a/x.txt"
        )

    def test_api_restore_hunk_only_unstaged(self):
        wid = self.add()
        notes = self.repo / "notes.txt"
        notes.write_text("note\nmore\n", "utf-8")
        status, data = self.call("/diff?ws=%s&path=notes.txt" % wid)
        self.assertEqual(status, 200, data)
        hunk = hunksmod.parse_hunks(data["text"])[0]
        status, result = self.call(
            "/restore-hunk", {"ws": wid, "path": "notes.txt", "hunk": hunk["text"]}
        )
        self.assertEqual(status, 200, result)
        self.assertEqual(notes.read_text("utf-8"), "note\n")

        # 暂存过的改动不在工作区差异里，不能从这里还原。
        status, result = self.call(
            "/restore-hunk", {"ws": wid, "path": "sub/a.txt", "hunk": hunk["text"]}
        )
        self.assertEqual(status, 409, result)
        self.assertEqual((self.repo / "sub" / "a.txt").read_text("utf-8"), "hello\nworld\n")

    def test_api_changes_status_groups(self):
        wid = self.add()
        status, data = self.call("/changes?ws=" + wid)
        self.assertEqual(status, 200, data)
        staged = [f["path"] for f in data["status"]["staged"]]
        unstaged = [f["path"] for f in data["status"]["unstaged"]]
        self.assertIn("sub/a.txt", staged)
        self.assertIn("new.txt", staged)
        self.assertIn("sub/untracked.txt", unstaged)
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

    def test_api_accepts_plain_dir(self):
        # 仓库之外的临时目录既不在 SVN 里，也不在 Git 里，按普通目录收下，只给资源管理器页签。
        with tempfile.TemporaryDirectory() as tmp:
            status, data = self.call("/workspaces", {"root": tmp})
            self.assertEqual(status, 200, data)
            self.assertEqual(data["workspace"]["vcs"], "none")
            # 别的用例共用这份登记表，用完移走。
            self.call("/forget", {"ws": data["workspace"]["id"]})

    def test_api_serves_static_page(self):
        with urllib.request.urlopen(self.base.rsplit("/__idex/api", 1)[0] + "/") as resp:
            self.assertEqual(resp.status, 200)
            self.assertIn(b"<html>", resp.read())


class GitSubdirHistory(unittest.TestCase):
    """工作区是仓库子目录时，路径过滤会省掉目录外提交，日志里的父提交要被 git 改写。"""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory(prefix="idex-git-subdir-")
        cls.repo = Path(cls.tmp.name) / "repo"
        cls.repo.mkdir()
        run(["git", "init", "-q"], cwd=cls.repo)
        web = cls.repo / "web"
        web.mkdir()
        (web / "a.txt").write_text("1\n", "utf-8")
        run(["git", "add", "-A"], cwd=cls.repo)
        run(["git", "commit", "-qm", "web 第一次"], cwd=cls.repo)
        other = cls.repo / "other"
        other.mkdir()
        (other / "b.txt").write_text("b\n", "utf-8")
        run(["git", "add", "-A"], cwd=cls.repo)
        run(["git", "commit", "-qm", "目录外提交"], cwd=cls.repo)
        (web / "a.txt").write_text("2\n", "utf-8")
        run(["git", "commit", "-qam", "web 第二次"], cwd=cls.repo)

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_status_and_detail_paths_are_workspace_relative(self):
        (self.repo / "web" / "a.txt").write_text("3\n", "utf-8")
        changes = gitmod.git_changes(str(self.repo / "web"))
        self.assertEqual(changes["files"][0]["path"], "a.txt")
        head = git_out("rev-parse", "HEAD", cwd=self.repo)
        detail = gitmod.git_commit_detail(str(self.repo / "web"), head)
        self.assertEqual(detail["paths"][0]["path"], "a.txt")

    def test_revision_original_accepts_repo_relative_log_path(self):
        head = git_out("rev-parse", "HEAD", cwd=self.repo)
        data = gitmod.git_original(str(self.repo / "web"), "web/a.txt", "head", head)
        self.assertEqual(data["text"], "2\n")

    def test_worktree_diff_uses_workspace_relative_path(self):
        (self.repo / "web" / "a.txt").write_text("3\n", "utf-8")
        data = gitmod.git_change_diff(str(self.repo / "web"), "a.txt", False, "head")
        self.assertIn("a.txt", data["text"])
        self.assertIn("+3", data["text"])

    def test_log_parents_are_rewritten_for_subdir(self):
        entries = gitmod.git_log(str(self.repo / "web"), 10)
        self.assertEqual([entry["message"] for entry in entries], ["web 第二次", "web 第一次"])
        # 目录外的中间提交不在列表里，父提交要落到上一个仍可见的提交。
        self.assertEqual(entries[0]["parents"], [entries[1]["revision"]])


class GitOriginal(unittest.TestCase):
    """差异编辑器要的原始版本：工作区对索引，已暂存对 HEAD，未跟踪为空。"""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="idex-git-original-")
        self.repo = Path(self.tmp.name) / "repo"
        (self.repo / "web").mkdir(parents=True)
        run(["git", "init", "-q"], cwd=self.repo)
        (self.repo / "web" / "a.txt").write_text("one\n", "utf-8")
        run(["git", "add", "-A"], cwd=self.repo)
        run(["git", "commit", "-qm", "one"], cwd=self.repo)

    def tearDown(self):
        self.tmp.cleanup()

    def original(self, rel="a.txt", scope="worktree", rev=None):
        return gitmod.git_original(str(self.repo / "web"), rel, scope, rev)

    def test_worktree_original_is_index_version(self):
        (self.repo / "web" / "a.txt").write_text("two\n", "utf-8")
        self.assertEqual(self.original()["text"], "one\n")
        run(["git", "add", "-A"], cwd=self.repo)
        self.assertEqual(self.original()["text"], "two\n")

    def test_staged_original_is_head_version(self):
        (self.repo / "web" / "a.txt").write_text("two\n", "utf-8")
        run(["git", "add", "-A"], cwd=self.repo)
        self.assertEqual(self.original(scope="staged")["text"], "one\n")

    def test_head_scope_is_head_version(self):
        (self.repo / "web" / "a.txt").write_text("two\n", "utf-8")
        run(["git", "add", "-A"], cwd=self.repo)
        self.assertEqual(self.original(scope="head")["text"], "one\n")

    def test_untracked_file_has_empty_original(self):
        (self.repo / "web" / "new.txt").write_text("new\n", "utf-8")
        self.assertEqual(self.original("new.txt")["text"], "")

    def test_deleted_file_keeps_index_original(self):
        (self.repo / "web" / "a.txt").unlink()
        self.assertEqual(self.original()["text"], "one\n")

    def test_explicit_revision(self):
        (self.repo / "web" / "a.txt").write_text("two\n", "utf-8")
        run(["git", "commit", "-qam", "two"], cwd=self.repo)
        head = git_out("rev-parse", "HEAD", cwd=self.repo)
        self.assertEqual(self.original(rev=head)["text"], "two\n")


class GitRemoteLog(unittest.TestCase):
    """有远端时取日志先同步：别人刚推的提交要列出来，并标成远程。"""

    def test_log_syncs_remote_and_marks_entry(self):
        with tempfile.TemporaryDirectory(prefix="idex-git-remote-") as tmp:
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
        self.tmp = tempfile.TemporaryDirectory(prefix="idex-git-op-")
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

    def test_log_keeps_merge_commit_with_path_filter(self):
        run(["git", "switch", "-q", "-c", "side"], cwd=self.work)
        (self.work / "side.txt").write_text("s\n", "utf-8")
        run(["git", "add", "-A"], cwd=self.work)
        run(["git", "commit", "-qm", "side 改动"], cwd=self.work)
        run(["git", "switch", "-q", "main"], cwd=self.work)
        run(["git", "merge", "-q", "--no-ff", "-m", "合并 side", "side"], cwd=self.work)
        entries = gitmod.git_log(str(self.work), 10)
        # 路径过滤默认会省掉没改这个目录的合并提交，时间线会断，所以要看得到它。
        self.assertEqual(entries[0]["message"], "合并 side")
        self.assertEqual(len(entries[0]["parents"]), 2)
        # 标 local 的 rev-list 也要用同一套完整历史，否则这条合并会显示成「待拉取」。
        self.assertTrue(entries[0]["local"])

    def test_log_all_refs_covers_branches_and_tags(self):
        run(["git", "switch", "-q", "-c", "dev"], cwd=self.work)
        (self.work / "dev.txt").write_text("dev\n", "utf-8")
        run(["git", "add", "dev.txt"], cwd=self.work)
        run(["git", "commit", "-qm", "dev 提交"], cwd=self.work)
        run(["git", "tag", "light"], cwd=self.work)
        run(["git", "switch", "-q", "main"], cwd=self.work)
        run(["git", "tag", "-a", "ann", "-m", "附注标签"], cwd=self.work)

        default = [e["message"] for e in gitmod.git_log(str(self.work), 10)]
        self.assertNotIn("dev 提交", default)

        entries = gitmod.git_log(str(self.work), 10, all_refs=True)
        by_msg = {e["message"]: e for e in entries}
        dev = by_msg["dev 提交"]
        # 只在本地分支上，还没进远端。
        self.assertTrue(dev["local"])
        self.assertFalse(dev["pushed"])
        self.assertEqual(
            [(r["name"], r["kind"]) for r in dev["labels"]], [("dev", "head"), ("light", "tag")]
        )
        main = next(e for e in entries if e["head"])
        self.assertEqual(
            [(r["name"], r["kind"]) for r in main["labels"]],
            [("main", "head"), ("origin/main", "remote"), ("ann", "tag")],
        )

    def checkout(self, **body):
        """按页面发来的参数生成切换命令并执行，返回 git_op 的结果。"""
        plan = gitmod.operation_plan(
            {"id": "x", "root": str(self.work), "vcs": "git"},
            {"action": "checkout", **body},
        )
        self.assertEqual(len(plan["commands"]), 1)
        argv = plan["commands"][0]
        self.assertEqual(argv[:3], ["git", "--no-pager", "switch"])
        return gitmod.git_op(plan["cwd"], argv[2:], "switch")

    def test_branches_lists_local_and_remote(self):
        branches = gitmod.git_branches(str(self.work))
        local = {b["name"]: b for b in branches if not b["remote"]}
        self.assertTrue(local["main"]["current"])
        self.assertEqual(local["main"]["upstream"], "origin/main")
        # 远端 main 已经有同名本地分支，不再列成可新建的远端分支。
        self.assertNotIn("origin/main", [b.get("start_point") for b in branches if b["remote"]])

        run(["git", "branch", "feature", "main"], cwd=self.other)
        run(["git", "push", "-q", "origin", "feature"], cwd=self.other)
        run(["git", "fetch", "-q", "origin"], cwd=self.work)
        remote = {b["start_point"]: b for b in gitmod.git_branches(str(self.work)) if b["remote"]}
        self.assertTrue(remote["origin/feature"]["remote"])
        self.assertEqual(remote["origin/feature"]["name"], "feature")
        self.assertFalse(remote["origin/feature"]["current"])

    def test_checkout_switches_local_branch(self):
        run(["git", "branch", "dev", "main"], cwd=self.work)
        result = self.checkout(branch="dev")
        self.assertTrue(result["ok"], result)
        self.assertEqual(git_out("rev-parse", "--abbrev-ref", "HEAD", cwd=self.work), "dev")

    def test_checkout_creates_branch_from_head(self):
        result = self.checkout(branch="topic", create=True)
        self.assertTrue(result["ok"], result)
        self.assertEqual(git_out("rev-parse", "--abbrev-ref", "HEAD", cwd=self.work), "topic")
        self.assertEqual(git_out("rev-parse", "HEAD", cwd=self.work), git_out("rev-parse", "main", cwd=self.work))

    def test_checkout_tracks_remote_branch(self):
        run(["git", "branch", "feature", "main"], cwd=self.other)
        run(["git", "push", "-q", "origin", "feature"], cwd=self.other)
        run(["git", "fetch", "-q", "origin"], cwd=self.work)
        result = self.checkout(branch="feature", start_point="origin/feature")
        self.assertTrue(result["ok"], result)
        self.assertEqual(git_out("rev-parse", "--abbrev-ref", "HEAD", cwd=self.work), "feature")
        self.assertEqual(
            git_out("rev-parse", "--abbrev-ref", "@{upstream}", cwd=self.work), "origin/feature"
        )

    def test_checkout_rejects_bad_name_and_missing_branch(self):
        for name in ("", "-b", "bad..name", "a b"):
            with self.assertRaises(gitmod.ApiError):
                self.checkout(branch=name)
        with self.assertRaises(gitmod.ApiError):
            self.checkout(branch="no-such-branch")
        with self.assertRaises(gitmod.ApiError):
            self.checkout(branch="feature", start_point="origin/no-such")
        # 失败后还留在原分支。
        self.assertEqual(git_out("rev-parse", "--abbrev-ref", "HEAD", cwd=self.work), "main")

    def test_checkout_reports_dirty_conflict(self):
        # dev 上改了 a.txt，切回 main 后在本地再改一份，切回 dev 会被拒绝。
        run(["git", "switch", "-q", "-c", "dev"], cwd=self.work)
        (self.work / "a.txt").write_text("dev\n", "utf-8")
        run(["git", "commit", "-qam", "dev 改动"], cwd=self.work)
        run(["git", "switch", "-q", "main"], cwd=self.work)
        (self.work / "a.txt").write_text("local\n", "utf-8")
        result = self.checkout(branch="dev")
        self.assertFalse(result["ok"], result)
        self.assertIn("a.txt", result["output"])
        self.assertEqual(git_out("rev-parse", "--abbrev-ref", "HEAD", cwd=self.work), "main")

    def test_commit_detail_keeps_chinese_paths(self):
        # git show --name-status 默认把非 ASCII 路径加 C 风格引号，取出的路径要能直接看差异。
        target = self.work / "AKSK组件" / "README.md"
        target.parent.mkdir()
        target.write_text("组件说明\n", "utf-8")
        run(["git", "add", "AKSK组件/README.md"], cwd=self.work)
        run(["git", "commit", "-qm", "中文路径"], cwd=self.work)
        sha = git_out("rev-parse", "HEAD", cwd=self.work)
        detail = gitmod.git_commit_detail(str(self.work), sha)
        self.assertEqual([p["path"] for p in detail["paths"]], ["AKSK组件/README.md"])
        result = gitmod.git_revision_diff(str(self.work), sha, detail["paths"][0]["path"])
        self.assertIn("组件说明", result["text"])

    def test_commit_detail_parses_chinese_rename(self):
        (self.work / "AKSK组件").mkdir()
        run(["git", "mv", "a.txt", "AKSK组件/说明.md"], cwd=self.work)
        run(["git", "commit", "-qm", "中文改名"], cwd=self.work)
        sha = git_out("rev-parse", "HEAD", cwd=self.work)
        paths = gitmod.git_commit_detail(str(self.work), sha)["paths"]
        self.assertEqual(
            [(p["action"], p["path"], p["copyfrom"]) for p in paths],
            [("R", "AKSK组件/说明.md", "a.txt")],
        )

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
        run(["git", "add", "-A"], cwd=self.work)
        plan = gitmod.operation_plan(
            {"id": "x", "root": str(self.work), "vcs": "git"},
            {"action": "commit", "message": "两处改动"},
        )
        self.assertEqual(len(plan["commands"]), 1)
        for argv in plan["commands"]:
            run(argv, cwd=plan["cwd"])
        self.assertEqual(git_out("log", "-1", "--format=%s", cwd=self.work), "两处改动")
        self.assertEqual(git_out("status", "--porcelain", cwd=self.work), "")

    def test_commit_handles_rename(self):
        run(["git", "mv", "a.txt", "c.txt"], cwd=self.work)
        plan = gitmod.operation_plan(
            {"id": "x", "root": str(self.work), "vcs": "git"},
            {"action": "commit", "message": "改名"},
        )
        for argv in plan["commands"]:
            run(argv, cwd=plan["cwd"])
        self.assertEqual(git_out("status", "--porcelain", cwd=self.work), "")
        shown = git_out("show", "--name-status", "--format=", "HEAD", cwd=self.work)
        self.assertIn("c.txt", shown)
        self.assertIn("a.txt", shown)

    def test_commit_includes_all_staged_paths(self):
        """索引里有什么就提交什么，不再按勾选过滤。"""
        (self.work / "a.txt").write_text("a\nchanged\n", "utf-8")
        (self.work / "b.txt").write_text("b\n", "utf-8")
        run(["git", "add", "-A"], cwd=self.work)
        plan = gitmod.operation_plan(
            {"id": "x", "root": str(self.work), "vcs": "git"},
            {"action": "commit", "message": "两条都提交"},
        )
        for argv in plan["commands"]:
            run(argv, cwd=plan["cwd"])
        shown = git_out("show", "--name-only", "--format=", "HEAD", cwd=self.work)
        self.assertIn("a.txt", shown)
        self.assertIn("b.txt", shown)

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
        self.assertTrue(any(b["current"] and b["name"] == "main" for b in info["branches"]))


class GitIndexOps(unittest.TestCase):
    """暂存、取消暂存走网页接口；每个用例单独建仓库，互不影响。"""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="idex-index-")
        base = Path(self.tmp.name)
        self.repo = base / "repo"
        self.static = base / "static"
        self.static.mkdir()
        (self.static / "index.html").write_text("<html></html>", "utf-8")
        run(["git", "init", "-q", "-b", "main", str(self.repo)])
        (self.repo / "tracked.txt").write_text("base\n", "utf-8")
        run(["git", "add", "-A"], cwd=self.repo)
        run(["git", "commit", "-qm", "first"], cwd=self.repo)
        (self.repo / "sub").mkdir()
        (self.repo / "sub" / "new.txt").write_text("new\n", "utf-8")
        self.server = serve(gitmod.Handler, static=self.static.resolve(),
                            api_prefix="/__idex/api",
                            store=gitmod.Workspaces(str(base / "state.json")))
        code, data = json_call(self.server.base, "/workspaces", {"root": str(self.repo)})
        self.assertEqual(code, 200, data)
        self.ws = data["workspace"]["id"]

    def tearDown(self):
        self.server.shutdown()
        self.tmp.cleanup()

    def call(self, path, body=None):
        return json_call(self.server.base, path, body)

    def test_stage_untracked_moves_it_to_staged_group(self):
        code, data = self.call("/stage", {"ws": self.ws, "paths": ["sub/new.txt"]})
        self.assertEqual(code, 200)
        self.assertEqual([i["path"] for i in data["status"]["staged"]], ["sub/new.txt"])
        self.assertEqual(data["status"]["unstaged"], [])

    def test_sync_info_has_status_and_conflicts(self):
        run(["git", "add", "-A"], cwd=self.repo)
        code, data = self.call("/sync-info?ws=" + self.ws)
        self.assertEqual(code, 200)
        self.assertEqual([i["path"] for i in data["status"]["staged"]], ["sub/new.txt"])
        self.assertEqual(data["conflicts"], [])

    def test_unstage_rename_restores_both_ends(self):
        run(["git", "mv", "tracked.txt", "moved.txt"], cwd=self.repo)
        code, _ = self.call("/unstage", {"ws": self.ws, "paths": ["moved.txt"]})
        self.assertEqual(code, 200)
        status = git_out("status", "--porcelain", cwd=self.repo)
        self.assertNotIn("D  tracked.txt", status)
        self.assertIn("?? moved.txt", status)

    def test_unstage_without_head_removes_from_index(self):
        fresh = Path(self.tmp.name) / "fresh"
        run(["git", "init", "-q", "-b", "main", str(fresh)])
        (fresh / "only.txt").write_text("x\n", "utf-8")
        run(["git", "add", "only.txt"], cwd=fresh)
        args = gitmod.git_unstage_args(str(fresh), ["only.txt"])
        self.assertEqual(args[0], "rm")
        run(["git", *args], cwd=fresh)
        self.assertEqual(git_out("status", "--porcelain", cwd=fresh), "?? only.txt")

    def test_commit_rejects_empty_index(self):
        with self.assertRaises(gitmod.ApiError) as ctx:
            gitmod.git_commit_commands(self.repo, "msg")
        self.assertIn("索引里没有暂存内容", str(ctx.exception))

    def test_commit_builds_index_only_command(self):
        run(["git", "add", "sub/new.txt"], cwd=self.repo)
        commands = gitmod.git_commit_commands(self.repo, "msg")
        self.assertEqual(commands, [["git", "--no-pager", "commit", "-m", "msg"]])

    def test_commit_stage_all_prepends_add(self):
        commands = gitmod.git_commit_commands(self.repo, "msg", stage_all=True)
        self.assertEqual(commands[0], ["git", "--no-pager", "add", "-A", "--", "."])
        self.assertEqual(commands[1], ["git", "--no-pager", "commit", "-m", "msg"])

    def test_commit_rejects_conflicts_even_with_stage_all(self):
        make_conflict(self.repo)
        for stage_all in (False, True):
            with self.assertRaises(gitmod.ApiError) as ctx:
                gitmod.git_commit_commands(self.repo, "msg", stage_all=stage_all)
            self.assertIn("a.txt", str(ctx.exception))

    def test_commit_operation_has_no_paths(self):
        run(["git", "add", "-A"], cwd=self.repo)
        plan = gitmod.operation_plan(
            {"id": "x", "root": str(self.repo), "vcs": "git"},
            {"action": "commit", "message": "m"},
        )
        self.assertEqual(plan["command"], "git --no-pager commit -m m")

    def test_commit_without_staged_or_changes_returns_400(self):
        fresh = Path(self.tmp.name) / "clean"
        run(["git", "init", "-q", "-b", "main", str(fresh)])
        with self.assertRaises(gitmod.ApiError) as ctx:
            gitmod.git_commit_commands(str(fresh), "m")
        self.assertIn("索引里没有暂存内容", str(ctx.exception))


class GitStatusParse(unittest.TestCase):
    def test_fields_keep_both_columns_and_rename_source(self):
        raw = b"M  a.txt\0 M b.txt\0MM c.txt\0?? d.txt\0R  new.txt\0old.txt\0"
        files, _ = gitmod.parse_git_status(raw)
        by_path = {item["path"]: item for item in files}
        self.assertEqual((by_path["a.txt"]["index"], by_path["a.txt"]["worktree"]), ("M", " "))
        self.assertEqual((by_path["b.txt"]["index"], by_path["b.txt"]["worktree"]), (" ", "M"))
        self.assertEqual((by_path["c.txt"]["index"], by_path["c.txt"]["worktree"]), ("M", "M"))
        self.assertEqual((by_path["d.txt"]["index"], by_path["d.txt"]["worktree"]), ("?", "?"))
        self.assertEqual(by_path["new.txt"]["orig"], "old.txt")
        self.assertEqual(by_path["a.txt"]["item"], "modified")

    def test_split_status_groups_both_columns(self):
        files = [
            {"path": "a", "item": "modified", "index": "M", "worktree": " "},
            {"path": "b", "item": "modified", "index": "M", "worktree": "M"},
            {"path": "c", "item": "unversioned", "index": "?", "worktree": "?"},
            {"path": "d", "item": "conflicted", "index": "U", "worktree": "U"},
            {"path": "e", "item": "renamed", "index": "R", "worktree": " ", "orig": "z"},
        ]
        groups = gitmod.split_status(files)
        self.assertEqual([i["path"] for i in groups["staged"]], ["a", "b", "e"])
        self.assertEqual([i["path"] for i in groups["unstaged"]], ["b", "c"])
        self.assertEqual([i["path"] for i in groups["conflicts"]], ["d"])
        self.assertEqual(groups["staged"][2]["item"], "renamed")
        self.assertEqual(groups["unstaged"][0]["item"], "modified")
        self.assertEqual(groups["unstaged"][1]["item"], "unversioned")


class GitDiffScope(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="idex-scope-")
        self.repo = Path(self.tmp.name) / "repo"
        run(["git", "init", "-q", "-b", "main", str(self.repo)])
        (self.repo / "a.txt").write_text("base\n", "utf-8")
        run(["git", "add", "-A"], cwd=self.repo)
        run(["git", "commit", "-qm", "first"], cwd=self.repo)
        (self.repo / "a.txt").write_text("base\nstaged\n", "utf-8")
        run(["git", "add", "-A"], cwd=self.repo)
        (self.repo / "a.txt").write_text("base\nstaged\nworktree\n", "utf-8")

    def tearDown(self):
        self.tmp.cleanup()

    def test_staged_scope_shows_index_only(self):
        data = gitmod.git_change_diff(self.repo, "a.txt", scope="staged")
        self.assertIn("+staged", data["text"])
        self.assertNotIn("+worktree", data["text"])

    def test_worktree_scope_shows_unstaged_only(self):
        data = gitmod.git_change_diff(self.repo, "a.txt", scope="worktree")
        self.assertIn("+worktree", data["text"])
        self.assertNotIn("+staged", data["text"])

    def test_unborn_head_staged_scope_reads_index(self):
        fresh = Path(self.tmp.name) / "fresh"
        run(["git", "init", "-q", "-b", "main", str(fresh)])
        (fresh / "only.txt").write_text("x\n", "utf-8")
        run(["git", "add", "only.txt"], cwd=fresh)
        data = gitmod.git_change_diff(fresh, "only.txt", scope="staged")
        self.assertIn("+x", data["text"])


class GitDiffConflict(unittest.TestCase):
    """单独建仓库造冲突，免得把 GitDiffScope 的仓库留在合并中。"""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="idex-conflict-")
        self.repo = Path(self.tmp.name) / "repo"
        run(["git", "init", "-q", "-b", "main", str(self.repo)])
        (self.repo / "a.txt").write_text("base\n", "utf-8")
        run(["git", "add", "-A"], cwd=self.repo)
        run(["git", "commit", "-qm", "first"], cwd=self.repo)

    def tearDown(self):
        self.tmp.cleanup()

    def test_conflict_uses_head_diff_not_combined(self):
        make_conflict(self.repo)
        files, _ = gitmod.parse_git_status(
            gitmod.git(["status", "--porcelain", "-z", "-uall"], cwd=self.repo)[1]
        )
        self.assertIn("conflicted", {item["item"] for item in files})
        data = gitmod.git_change_diff(self.repo, "a.txt", scope="head")
        self.assertTrue(data["text"].startswith("diff --git"))
        self.assertNotIn("diff --cc", data["text"])


class SearchSettings(unittest.TestCase):
    """搜索跳过的目录与全局设置的保存。"""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="idex-search-")
        self.base = Path(self.tmp.name)
        self.root = self.base / "repo"
        self.root.mkdir()
        (self.root / "notes.txt").write_text("hit\n", "utf-8")
        for name in ("node_modules", "dist"):
            (self.root / name).mkdir()
            (self.root / name / "x.txt").write_text("hit\n", "utf-8")

    def tearDown(self):
        self.tmp.cleanup()

    def test_ignore_skips_dirs_at_any_level(self):
        hits = gitmod.browse_search(str(self.root), "", "x.txt", "name")
        self.assertEqual([m["path"] for m in hits["matches"]],
                         ["dist/x.txt", "node_modules/x.txt"])
        hits = gitmod.browse_search(str(self.root), "", "x.txt", "name", ["dist"])
        self.assertEqual([m["path"] for m in hits["matches"]], ["node_modules/x.txt"])
        hits = gitmod.browse_search(str(self.root), "", "x.txt", "name",
                                    ("dist", "node_modules"))
        self.assertEqual(hits["matches"], [])

    def test_settings_store_defaults_sanitizes_and_persists(self):
        path = self.base / "settings.json"
        store = gitmod.Settings(str(path))
        self.assertEqual(store.search_ignore(), list(gitmod.SEARCH_IGNORE_DEFAULTS))

        names = store.set_search_ignore(
            [" node_modules ", "node_modules", "/etc", "dist/", "", ".."]
        )
        self.assertEqual(names, ["node_modules"])
        self.assertEqual(gitmod.Settings(str(path)).search_ignore(), ["node_modules"])

        # 存一份空名单就是不跳过任何目录，不会退回默认。
        gitmod.Settings(str(path)).set_search_ignore([])
        self.assertEqual(gitmod.Settings(str(path)).search_ignore(), [])

        # 编辑器设置按字段更新，没提到的字段不动；非法配色回 auto。
        store.update({"editor_theme": "dracula", "minimap": True})
        again = gitmod.Settings(str(path))
        self.assertEqual(again.editor_theme(), "dracula")
        self.assertTrue(again.minimap())
        again.update({"editor_theme": "不存在"})
        self.assertEqual(gitmod.Settings(str(path)).editor_theme(), "auto")
        self.assertTrue(gitmod.Settings(str(path)).minimap())


class SearchSettingsApi(unittest.TestCase):
    """设置接口与搜索按设置跳过目录。"""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="idex-settings-")
        base = Path(self.tmp.name)
        self.repo = base / "repo"
        self.repo.mkdir()
        (self.repo / "notes.txt").write_text("hit\n", "utf-8")
        # vendor 不在默认名单里，改了设置之后才该被跳过。
        (self.repo / "vendor").mkdir()
        (self.repo / "vendor" / "x.txt").write_text("hit\n", "utf-8")
        self.static = base / "static"
        self.static.mkdir()
        (self.static / "index.html").write_text("<html></html>", "utf-8")
        self.server = serve(
            gitmod.Handler,
            static=self.static.resolve(),
            api_prefix="/__idex/api",
            store=gitmod.Workspaces(str(base / "state.json")),
            settings=gitmod.Settings(str(base / "settings.json")),
        )
        code, data = json_call(self.server.base, "/workspaces", {"root": str(self.repo)})
        self.assertEqual(code, 200, data)
        self.ws = data["workspace"]["id"]

    def tearDown(self):
        self.server.shutdown()
        self.tmp.cleanup()

    def call(self, path, body=None):
        return json_call(self.server.base, path, body)

    def test_settings_roundtrip_and_search(self):
        code, data = self.call("/settings")
        self.assertEqual(code, 200, data)
        self.assertEqual(data["search_ignore"], list(gitmod.SEARCH_IGNORE_DEFAULTS))
        # 默认模板一份：接口返回的 defaults 覆盖搜索、配色与代码地图。
        self.assertEqual(data["defaults"]["search_ignore"], list(gitmod.SEARCH_IGNORE_DEFAULTS))
        self.assertEqual(data["defaults"]["editor_theme"], "auto")
        self.assertFalse(data["defaults"]["minimap"])

        code, data = self.call("/search?ws=%s&q=x.txt&mode=name" % self.ws)
        self.assertEqual(code, 200, data)
        self.assertEqual([m["path"] for m in data["matches"]], ["vendor/x.txt"])

        code, data = self.call("/settings", {"search_ignore": ["vendor"]})
        self.assertEqual(code, 200, data)
        self.assertEqual(data["search_ignore"], ["vendor"])

        code, data = self.call("/search?ws=%s&q=x.txt&mode=name" % self.ws)
        self.assertEqual(code, 200, data)
        self.assertEqual(data["matches"], [])

        # 带斜杠的、重复的都清掉。
        code, data = self.call(
            "/settings", {"search_ignore": [" /tmp ", "dist", "node_modules", "dist"]}
        )
        self.assertEqual(data["search_ignore"], ["dist", "node_modules"])

        # 编辑器设置与服务端持久化；只改一个字段时其余字段保留。
        code, data = self.call("/settings", {"editor_theme": "one-dark", "minimap": True})
        self.assertEqual(code, 200, data)
        self.assertEqual(data["editor_theme"], "one-dark")
        self.assertTrue(data["minimap"])
        code, data = self.call("/settings", {"search_ignore": ["vendor"]})
        self.assertEqual(data["editor_theme"], "one-dark")
        self.assertTrue(data["minimap"])
        code, data = self.call("/settings")
        self.assertEqual(data["editor_theme"], "one-dark")


if __name__ == "__main__":
    unittest.main(verbosity=2)
