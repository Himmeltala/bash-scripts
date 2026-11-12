#!/usr/bin/env python3
"""dvcsx 回归：临时 SVN 仓库上的状态解析、差异、日志与网页接口。"""

import importlib.util
import json
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


svnmod = load_server()


def run(args, cwd=None):
    cp = subprocess.run(args, cwd=cwd, capture_output=True, text=True)
    if cp.returncode != 0:
        raise RuntimeError("%s 失败：%s" % (" ".join(args), cp.stderr.strip()))
    return cp.stdout


class SvnWorkspace(unittest.TestCase):
    """一个带一次提交的工作副本：src/a.txt 改动过，b.txt 未纳入版本控制。"""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory(prefix="dvcsx-test-")
        base = Path(cls.tmp.name)
        cls.repo = base / "repo"
        cls.wc = base / "wc"
        cls.static = base / "static"
        cls.static.mkdir()
        (cls.static / "index.html").write_text("<html></html>", "utf-8")

        run(["svnadmin", "create", str(cls.repo)])
        cls.url = "file://" + str(cls.repo)
        run(["svn", "checkout", "-q", cls.url, str(cls.wc)])
        (cls.wc / "src").mkdir()
        (cls.wc / "src" / "a.txt").write_text("hello\n", "utf-8")
        run(["svn", "add", "-q", "src"], cwd=cls.wc)
        run(["svn", "commit", "-q", "-m", "first", "."], cwd=cls.wc)

        (cls.wc / "src" / "a.txt").write_text("hello\nworld\n", "utf-8")
        (cls.wc / "b.txt").write_text("new\n", "utf-8")
        # 未纳入版本控制的目录里再放文件，以及一个不该展开的依赖目录。
        (cls.wc / "extra").mkdir()
        (cls.wc / "extra" / "one.txt").write_text("one\n", "utf-8")
        (cls.wc / "extra" / "node_modules").mkdir()
        (cls.wc / "extra" / "node_modules" / "x.js").write_text("x\n", "utf-8")

        cls.handler = svnmod.Handler
        cls.handler.static = cls.static.resolve()
        cls.handler.store = svnmod.Workspaces(str(base / "state.json"))
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
        status, data = self.call("/workspaces", {"root": str(self.wc)})
        self.assertEqual(status, 200, data)
        return data["workspace"]["id"]

    # ---- 直接调查询函数

    def test_info_reads_working_copy(self):
        info = svnmod.svn_info(str(self.wc))
        self.assertEqual(info["url"], self.url)
        self.assertEqual(info["repo_root"], self.url)
        self.assertTrue(info["root"].endswith("/wc"))

    def test_status_lists_modified_and_unversioned(self):
        rc, out, err = svnmod.svn(["status", "--xml"], cwd=str(self.wc))
        self.assertEqual(rc, 0, err)
        files = {f["path"]: f["item"] for f in svnmod.parse_status(out)}
        self.assertEqual(files.get("src/a.txt"), "modified")
        self.assertEqual(files.get("b.txt"), "unversioned")

    def test_diff_shows_new_line(self):
        result = svnmod.change_diff(str(self.wc), "src/a.txt")
        self.assertIn("+world", result["text"])
        self.assertIn("src/a.txt", result["text"])

    def test_unversioned_file_reads_as_content(self):
        self.assertEqual(svnmod.read_unversioned(str(self.wc), "b.txt"), "new\n")

    def test_unversioned_dir_expands_to_files(self):
        rc, out, err = svnmod.svn(["status", "--xml"], cwd=str(self.wc))
        self.assertEqual(rc, 0, err)
        files, truncated = svnmod.expand_unversioned(str(self.wc), svnmod.parse_status(out))
        paths = [f["path"] for f in files]
        self.assertIn("extra/one.txt", paths)
        self.assertNotIn("extra", paths)
        self.assertNotIn("extra/node_modules/x.js", paths)
        self.assertFalse(truncated)

    def test_browse_lists_and_reads_files(self):
        data = svnmod.browse_list(str(self.wc), "")
        types = {e["name"]: e["type"] for e in data["entries"]}
        self.assertEqual(types.get("src"), "dir")
        self.assertEqual(types.get("b.txt"), "file")
        # 工作副本内部目录不列出来。
        self.assertNotIn(".svn", types)
        data = svnmod.browse_list(str(self.wc), "extra")
        names = [e["name"] for e in data["entries"]]
        self.assertIn("one.txt", names)
        self.assertNotIn("node_modules", names)
        self.assertEqual(svnmod.browse_file(str(self.wc), "b.txt"), "new\n")

    def test_diff_rejects_path_outside(self):
        with self.assertRaises(svnmod.ApiError):
            svnmod.change_diff(str(self.wc), "../etc/passwd")

    def test_log_returns_commit(self):
        rc, out, err = svnmod.svn(
            ["log", "--xml", "-v", "-l", "5", "-r", "HEAD:1"], cwd=str(self.wc)
        )
        self.assertEqual(rc, 0, err)
        entries = svnmod.parse_log(out)
        self.assertEqual(entries[0]["revision"], "1")
        self.assertEqual(entries[0]["message"], "first")
        self.assertIn("/src/a.txt", [p["path"] for p in entries[0]["paths"]])

    def test_revision_diff_whole_and_single_path(self):
        whole = svnmod.revision_diff(str(self.wc), "1", "")
        self.assertIn("+hello", whole["text"])
        one = svnmod.revision_diff(str(self.wc), "1", "/src/a.txt")
        self.assertIn("+hello", one["text"])

    # ---- 接口

    def test_api_add_state_forget(self):
        wid = self.add()
        status, data = self.call("/state")
        self.assertEqual(status, 200)
        self.assertIn(wid, [w["id"] for w in data["workspaces"]])
        status, data = self.call("/forget", {"ws": wid})
        self.assertEqual(status, 200, data)
        status, data = self.call("/state")
        self.assertNotIn(wid, [w["id"] for w in data["workspaces"]])

    def test_api_changes_and_diffs(self):
        wid = self.add()
        status, data = self.call("/changes?ws=" + wid)
        self.assertEqual(status, 200, data)
        items = {f["path"]: f["item"] for f in data["files"]}
        self.assertEqual(items.get("src/a.txt"), "modified")
        self.assertEqual(items.get("b.txt"), "unversioned")

        status, data = self.call("/diff?ws=%s&path=src/a.txt&item=modified" % wid)
        self.assertEqual(status, 200, data)
        self.assertIn("+world", data["text"])

        status, data = self.call("/diff?ws=%s&path=b.txt&item=unversioned" % wid)
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
        self.assertEqual(data["entries"][0]["revision"], "1")

        status, data = self.call("/revision?ws=%s&rev=1" % wid)
        self.assertEqual(status, 200, data)
        self.assertIn("+hello", data["text"])

        status, data = self.call("/revision?ws=%s&rev=1&path=/src/a.txt" % wid)
        self.assertEqual(status, 200, data)
        self.assertIn("+hello", data["text"])
        self.call("/forget", {"ws": wid})

    def test_api_rejects_foreign_dir(self):
        # 仓库之外的临时目录既不在 SVN 里，也不在 Git 里，加不进来。
        with tempfile.TemporaryDirectory() as tmp:
            status, data = self.call("/workspaces", {"root": tmp})
        self.assertEqual(status, 400)
        self.assertIn("SVN", data["error"])

    def test_api_serves_static_page(self):
        with urllib.request.urlopen(self.base.rsplit("/__dvcsx/api", 1)[0] + "/") as resp:
            self.assertEqual(resp.status, 200)
            self.assertIn(b"<html>", resp.read())


class SvnRemoteLog(unittest.TestCase):
    """别人提交了新版本、本地还没更新时，日志里那条要标成远程。"""

    def test_commit_newer_than_wc_marked_remote(self):
        with tempfile.TemporaryDirectory(prefix="dvcsx-svn-remote-") as tmp:
            base = Path(tmp)
            repo = base / "repo"
            wc = base / "wc"
            other = base / "other"
            run(["svnadmin", "create", str(repo)])
            url = "file://" + str(repo)
            run(["svn", "checkout", "-q", url, str(wc)])
            (wc / "a.txt").write_text("a\n", "utf-8")
            run(["svn", "add", "-q", "a.txt"], cwd=wc)
            run(["svn", "commit", "-q", "-m", "本地那条", "."], cwd=wc)

            run(["svn", "checkout", "-q", url, str(other)])
            (other / "b.txt").write_text("b\n", "utf-8")
            run(["svn", "add", "-q", "b.txt"], cwd=other)
            run(["svn", "commit", "-q", "-m", "远端那条", "."], cwd=other)

            entries = svnmod.svn_log(str(wc), 5)
            by_msg = {e["message"]: e for e in entries}
            self.assertTrue(by_msg["本地那条"]["local"])
            self.assertFalse(by_msg["远端那条"]["local"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
