"""网页 SSE 的回归测试：登记表一变就推一份，外面提交或更新后推一条 head。"""

import http.client
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
SERVER = HERE.parent / "lib" / "idex" / "web" / "server.py"

# 测试按 python3 -I 跑，共享层不在 sys.path 上，显式加进去。
sys.path.insert(0, str(HERE.parent.parent / "lib" / "py-shared" / "commons"))
sys.path.insert(0, str(HERE.parent.parent / "lib" / "py-shared" / "services"))
from testkit import load_module, read_sse_event, serve

web = load_module("idex_web_server", SERVER)


def workspace(wid, root):
    return {"id": wid, "root": root, "vcs": "git", "url": "", "alias": "", "added": 1}


class StateSseTest(unittest.TestCase):
    def test_pushes_when_workspace_list_changes(self):
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "state.json"
            store = web.Workspaces(str(path))
            store.save([workspace("w1", "/tmp/a")])

            stream = web.StateStream(str(path), lambda: {"workspaces": store.workspaces()})
            stream.start()
            handler = type("TestHandler", (web.Handler,), {"state_stream": stream})
            with serve(handler, static=Path(td), api_prefix="/api") as server:
                conn = http.client.HTTPConnection("127.0.0.1", server.port, timeout=10)
                conn.request("GET", "/api/state/stream")
                resp = conn.getresponse()
                self.assertEqual(resp.status, 200)
                self.assertEqual(resp.getheader("Content-Type"), "text/event-stream; charset=utf-8")

                event, data = read_sse_event(resp)
                self.assertEqual(event, "state")
                self.assertEqual(len(json.loads(data)["workspaces"]), 1)

                store.save([workspace("w1", "/tmp/a"), workspace("w2", "/tmp/b")])
                event, data = read_sse_event(resp)
                self.assertEqual(event, "state")
                self.assertEqual(len(json.loads(data)["workspaces"]), 2)

                resp.close()
                conn.close()


class WorkspaceSseTest(unittest.TestCase):
    """工作副本的事件流：外面提交或更新后推一条 head，日志与同步页据此重读。"""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="idex-events-")
        base = Path(self.tmp.name)
        self.repo = base / "repo"
        # 临时仓库里的提交要作者信息，本机的全局配置不一定有。
        self.env = dict(
            os.environ,
            GIT_AUTHOR_NAME="Alice",
            GIT_AUTHOR_EMAIL="a@example.com",
            GIT_COMMITTER_NAME="Alice",
            GIT_COMMITTER_EMAIL="a@example.com",
        )
        self.git("init", "-q", "-b", "main", str(self.repo), cwd=None)
        (self.repo / "a.txt").write_text("one\n", "utf-8")
        self.git("add", "-A", cwd=self.repo)
        self.git("commit", "-qm", "first", cwd=self.repo)
        self.first = self.revision()

        self.store = web.Workspaces(str(base / "state.json"))
        self.store.save([workspace("w1", str(self.repo))])
        # 默认 3 秒一轮，测试里跑快一点。
        self.interval = web.WATCH_INTERVAL
        web.WATCH_INTERVAL = 0.1

    def tearDown(self):
        web.WATCH_INTERVAL = self.interval
        self.tmp.cleanup()

    def git(self, *args, cwd):
        cp = subprocess.run(
            ["git", *args], cwd=cwd, capture_output=True, text=True, env=self.env
        )
        if cp.returncode != 0:
            raise RuntimeError("%s 失败：%s" % (" ".join(args), cp.stderr.strip()))
        return cp.stdout

    def revision(self):
        return self.git("rev-parse", "HEAD", cwd=self.repo).strip()

    def next_head(self, resp):
        while True:
            event, data = read_sse_event(resp)
            self.assertTrue(event, "事件流断了")
            if event == "head":
                return json.loads(data)

    def test_pushes_head_after_external_commit(self):
        handler = type("TestHandler", (web.Handler,), {"store": self.store})
        with serve(handler, api_prefix="/api") as server:
            conn = http.client.HTTPConnection("127.0.0.1", server.port, timeout=10)
            conn.request("GET", "/api/events?ws=w1")
            resp = conn.getresponse()
            self.assertEqual(resp.status, 200)
            event, _ = read_sse_event(resp)
            self.assertEqual(event, "ready")
            # 连上先补一份当前版本，断线期间发生的提交不会漏掉。
            self.assertEqual(self.next_head(resp)["revision"], self.first)

            (self.repo / "a.txt").write_text("one\ntwo\n", "utf-8")
            self.git("commit", "-qam", "second", cwd=self.repo)
            self.assertEqual(self.next_head(resp)["revision"], self.revision())

            resp.close()
            conn.close()


if __name__ == "__main__":
    unittest.main()
