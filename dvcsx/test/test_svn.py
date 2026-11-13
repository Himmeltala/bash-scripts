#!/usr/bin/env python3
"""dvcsx 回归：临时 SVN 仓库上的状态解析、差异、日志与网页接口。"""

import http.client
import importlib.util
import json
import subprocess
import tempfile
import threading
import time
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

    def test_diff_full_context(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp) / "repo"
            wc = Path(tmp) / "wc"
            run(["svnadmin", "create", str(repo)])
            run(["svn", "checkout", "-q", "file://" + str(repo), str(wc)])
            lines = "".join("line %d\n" % i for i in range(1, 61))
            path = wc / "big.txt"
            path.write_text(lines, "utf-8")
            run(["svn", "add", "-q", "big.txt"], cwd=wc)
            run(["svn", "commit", "-q", "-m", "init", "."], cwd=wc)
            path.write_text(lines.replace("line 30\n", "line 30 changed\n"), "utf-8")
            short = svnmod.change_diff(str(wc), "big.txt")
            full = svnmod.change_diff(str(wc), "big.txt", full=True)
            # 默认只带改行附近几行上下文，整文件模式连第一行都带上。
            self.assertNotIn(" line 1\n", short["text"])
            self.assertIn(" line 1\n", full["text"])
            self.assertIn("+line 30 changed", full["text"])

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

    def test_log_meta_reports_working_revision(self):
        entries, meta = svnmod.svn_log_meta(str(self.wc), 5)
        self.assertEqual(meta["wc_revision"], 1)
        self.assertTrue(entries[0]["local"])

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


class SvnOperations(unittest.TestCase):
    """从同一个仓库拉出两份工作副本：更新、提交、冲突与同步信息。"""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="dvcsx-svn-op-")
        base = Path(self.tmp.name)
        self.repo = base / "repo"
        self.wc = base / "wc"
        self.other = base / "other"
        run(["svnadmin", "create", str(self.repo)])
        self.url = "file://" + str(self.repo)
        run(["svn", "checkout", "-q", self.url, str(self.wc)])
        (self.wc / "a.txt").write_text("a\n", "utf-8")
        run(["svn", "add", "-q", "a.txt"], cwd=self.wc)
        run(["svn", "commit", "-q", "-m", "base", "."], cwd=self.wc)
        run(["svn", "checkout", "-q", self.url, str(self.other)])

    def tearDown(self):
        self.tmp.cleanup()

    def test_update_brings_remote_commit(self):
        (self.other / "b.txt").write_text("b\n", "utf-8")
        run(["svn", "add", "-q", "b.txt"], cwd=self.other)
        run(["svn", "commit", "-q", "-m", "远端新版本", "."], cwd=self.other)
        result = svnmod.svn_update(str(self.wc))
        self.assertTrue(result["ok"], result)
        self.assertTrue((self.wc / "b.txt").is_file())
        self.assertEqual(svnmod.svn_info(str(self.wc))["revision"], "2")

    def test_commit_selected_paths(self):
        (self.wc / "a.txt").write_text("a\nchanged\n", "utf-8")
        result = svnmod.svn_commit(str(self.wc), "改一行", ["a.txt"])
        self.assertTrue(result["ok"], result)
        # 工作副本根目录的 BASE 停在提交前的版本，从 HEAD 往回想才看得到刚提交的那条。
        rc, out, err = svnmod.svn(["log", "--xml", "-v", "-r", "HEAD:1"], cwd=str(self.wc))
        self.assertEqual(rc, 0, err)
        entry = svnmod.parse_log(out)[0]
        self.assertEqual(entry["message"], "改一行")
        self.assertEqual(entry["revision"], "2")

    def test_commit_detail_keeps_full_message(self):
        (self.wc / "a.txt").write_text("a\nchanged\n", "utf-8")
        result = svnmod.svn_commit(str(self.wc), "标题\n\n正文", ["a.txt"])
        self.assertTrue(result["ok"], result)
        detail = svnmod.svn_commit_detail(str(self.wc), "2")
        self.assertEqual(detail["revision"], "2")
        self.assertEqual(detail["message"], "标题\n\n正文")

    def test_add_then_delete_revision_is_local_after_update(self):
        # 加一个文件再删掉，更新到删掉之后的版本；加文件那次提交已经在本地生效。
        (self.wc / "gone.txt").write_text("x\n", "utf-8")
        run(["svn", "add", "-q", "gone.txt"], cwd=self.wc)
        run(["svn", "commit", "-q", "-m", "加一个文件", "."], cwd=self.wc)
        run(["svn", "delete", "-q", "gone.txt"], cwd=self.wc)
        run(["svn", "commit", "-q", "-m", "删掉它", "."], cwd=self.wc)
        run(["svn", "update", "-q"], cwd=self.wc)
        self.assertEqual(svnmod.svn_info(str(self.wc))["revision"], "3")
        entries, _ = svnmod.svn_log_meta(str(self.wc), 10)
        by_msg = {entry["message"]: entry for entry in entries}
        self.assertTrue(by_msg["加一个文件"]["local"], by_msg["加一个文件"])
        self.assertTrue(by_msg["删掉它"]["local"], by_msg["删掉它"])

    def test_log_skip_pages(self):
        (self.wc / "a.txt").write_text("a\nchanged\n", "utf-8")
        result = svnmod.svn_commit(str(self.wc), "第二条", ["a.txt"])
        self.assertTrue(result["ok"], result)
        first, _ = svnmod.svn_log_meta(str(self.wc), 1, 0)
        second, _ = svnmod.svn_log_meta(str(self.wc), 1, 1)
        self.assertEqual([entry["message"] for entry in first], ["第二条"])
        self.assertEqual([entry["message"] for entry in second], ["base"])

    def test_commit_rejects_empty_message_and_unversioned(self):
        with self.assertRaises(svnmod.ApiError):
            svnmod.svn_commit(str(self.wc), "  ", ["a.txt"])
        (self.wc / "new.txt").write_text("new\n", "utf-8")
        with self.assertRaises(svnmod.ApiError):
            svnmod.svn_commit(str(self.wc), "说明", ["new.txt"])

    def test_conflicted_path_cannot_be_committed(self):
        # 两份工作副本改同一个文件的同一行，更新时就会冲突。
        (self.wc / "a.txt").write_text("本地改法\n", "utf-8")
        (self.other / "a.txt").write_text("远端改法\n", "utf-8")
        run(["svn", "commit", "-q", "-m", "远端改", "."], cwd=self.other)
        run(["svn", "update", "-q", "--accept", "postpone"], cwd=self.wc)
        info = svnmod.svn_sync_info(str(self.wc))
        self.assertIn("a.txt", info["conflicts"])
        with self.assertRaises(svnmod.ApiError):
            svnmod.svn_commit(str(self.wc), "冲突提交", ["a.txt"])

    def test_operation_plan_builds_svn_commit(self):
        (self.wc / "a.txt").write_text("a\nchanged\n", "utf-8")
        plan = svnmod.operation_plan(
            {"id": "x", "root": str(self.wc), "vcs": "svn"},
            {"action": "commit", "message": "说明", "paths": ["a.txt"]},
        )
        self.assertEqual(plan["action"], "commit")
        self.assertEqual(plan["cwd"], str(self.wc))
        self.assertEqual(plan["commands"][0][:4], ["svn", "--non-interactive", "commit", "-m"])
        self.assertEqual(plan["commands"][0][-2:], ["--", "a.txt"])
        self.assertIn("说明", plan["command"])

    def test_sync_info_lists_changes(self):
        (self.wc / "a.txt").write_text("a\nchanged\n", "utf-8")
        (self.wc / "new.txt").write_text("new\n", "utf-8")
        info = svnmod.svn_sync_info(str(self.wc))
        items = {item["path"]: item["item"] for item in info["files"]}
        self.assertEqual(items.get("a.txt"), "modified")
        # 未纳入版本控制的文件不进提交清单。
        self.assertNotIn("new.txt", items)


class ApiOperation(unittest.TestCase):
    """网页接口上的写操作：本机请求可执行，结果带回输出。"""

    def test_api_pull_operation(self):
        with tempfile.TemporaryDirectory(prefix="dvcsx-git-api-op-") as tmp:
            base = Path(tmp)
            work = base / "work"
            run(["git", "init", "-q", "-b", "main", str(work)])
            run(["git", "config", "user.name", "Alice"], cwd=work)
            run(["git", "config", "user.email", "a@example.com"], cwd=work)
            (work / "a.txt").write_text("a\n", "utf-8")
            run(["git", "add", "a.txt"], cwd=work)
            # 这个用例借用 server.py 的 Git 分支；临时仓库里没有全局作者信息。
            run(
                [
                    "git",
                    "-c", "user.name=Alice",
                    "-c", "user.email=a@example.com",
                    "commit", "-qm", "base",
                ],
                cwd=work,
            )
            bare = base / "origin.git"
            run(["git", "clone", "-q", "--bare", str(work), str(bare)])
            run(["git", "remote", "add", "origin", str(bare)], cwd=work)
            run(["git", "push", "-q", "-u", "origin", "main"], cwd=work)

            static = base / "static"
            static.mkdir()
            (static / "index.html").write_text("<html></html>", "utf-8")
            handler = svnmod.Handler
            handler.static = static.resolve()
            handler.store = svnmod.Workspaces(str(base / "state.json"))
            handler.api_prefix = "/__dvcsx/api"
            httpd = ThreadingHTTPServer(("127.0.0.1", 0), handler)
            threading.Thread(target=httpd.serve_forever, daemon=True).start()
            url = "http://127.0.0.1:%d/__dvcsx/api" % httpd.server_address[1]

            def call(path, body=None):
                data = json.dumps(body).encode("utf-8") if body is not None else None
                headers = {"Content-Type": "application/json"} if data else {}
                req = urllib.request.Request(url + path, data=data, headers=headers)
                try:
                    with urllib.request.urlopen(req) as resp:
                        return resp.status, json.loads(resp.read().decode("utf-8"))
                except urllib.error.HTTPError as exc:
                    return exc.code, json.loads(exc.read().decode("utf-8"))

            try:
                status, data = call("/workspaces", {"root": str(work)})
                self.assertEqual(status, 200, data)
                wid = data["workspace"]["id"]
                status, data = call("/sync-info?ws=" + wid)
                self.assertEqual(status, 200, data)
                self.assertTrue(data["writable"])
                self.assertEqual(data["upstream"], "origin/main")
                status, data = call("/operations", {"ws": wid, "action": "pull"})
                self.assertEqual(status, 200, data)
                job_id = data["id"]
                self.assertIn("pull", data["command"])
                # 操作在后台跑，轮询任务状态等它结束。
                job = {}
                deadline = time.time() + 15
                while time.time() < deadline:
                    status, job = call("/operations/" + job_id)
                    self.assertEqual(status, 200, job)
                    if job.get("done"):
                        break
                    time.sleep(0.1)
                self.assertTrue(job.get("done"), job)
                self.assertTrue(job["ok"], job)
                self.assertEqual(job["status"], "done")
                self.assertIn("pull", job["command"])
                status, data = call("/operations?ws=" + wid)
                self.assertEqual(status, 200, data)
                self.assertTrue(data["job"]["done"], data)

                # 任务结束后再连 SSE，也能从缓冲里拿到输出与结束事件。
                conn = http.client.HTTPConnection(
                    "127.0.0.1", httpd.server_address[1], timeout=15
                )
                conn.request(
                    "GET", "/__dvcsx/api/operations/%s/events" % job_id
                )
                events = conn.getresponse().read().decode("utf-8")
                conn.close()
                self.assertIn("event: done", events)
                self.assertIn("event: output", events)

                # 不认识的写操作要明确拒绝。
                status, data = call("/operations", {"ws": wid, "action": "force-push"})
                self.assertEqual(status, 400, data)

                # 工作副本的长连接先收到 ready，改动文件后收到 changes。
                conn = http.client.HTTPConnection(
                    "127.0.0.1", httpd.server_address[1], timeout=12
                )
                conn.request("GET", "/__dvcsx/api/events?ws=" + wid)
                resp = conn.getresponse()
                self.assertEqual(resp.status, 200)

                def read_event(name):
                    deadline = time.time() + 12
                    while time.time() < deadline:
                        line = resp.fp.readline()
                        if not line:
                            return False
                        if line.strip() == ("event: " + name).encode("utf-8"):
                            return True
                    return False

                self.assertTrue(read_event("ready"), "没有收到 ready 事件")
                (work / "a.txt").write_text("a\nchanged\n", "utf-8")
                self.assertTrue(read_event("changes"), "改动后没有收到 changes 事件")
                conn.close()

                # 网页提交：后台先暂存再提交，任务状态能拿到结果。
                status, data = call(
                    "/operations",
                    {
                        "ws": wid,
                        "action": "commit",
                        "message": "网页提交",
                        "paths": ["a.txt"],
                    },
                )
                self.assertEqual(status, 200, data)
                commit_id = data["id"]
                commit_job = {}
                deadline = time.time() + 15
                while time.time() < deadline:
                    status, commit_job = call("/operations/" + commit_id)
                    self.assertEqual(status, 200, commit_job)
                    if commit_job.get("done"):
                        break
                    time.sleep(0.1)
                self.assertTrue(commit_job.get("done"), commit_job)
                self.assertTrue(commit_job["ok"], commit_job)
                self.assertEqual(
                    run(["git", "log", "-1", "--format=%s"], cwd=work).strip(),
                    "网页提交",
                )

                # 不存在的工作区在开始推流之前就要报错。
                status, data = call("/events?ws=no-such-workspace")
                self.assertEqual(status, 404)
            finally:
                httpd.shutdown()
                httpd.server_close()


if __name__ == "__main__":
    unittest.main(verbosity=2)
