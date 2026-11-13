"""nodex 网页端：Node 版本发现、按工作区保存与环境拼装，以及状态快照。"""

import http.client
import importlib.util
import json
import os
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path

SERVER = Path(__file__).resolve().parent.parent / "lib" / "nodex" / "web" / "server.py"
spec = importlib.util.spec_from_file_location("nodex_web_server", SERVER)
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)


def make_node(home):
    """造一个能通过校验的 Node 目录：只要有 bin/node 就算。"""
    bindir = Path(home) / "bin"
    bindir.mkdir(parents=True, exist_ok=True)
    exe = bindir / "node"
    exe.write_text("#!/bin/sh\n", encoding="utf-8")
    exe.chmod(0o755)
    return Path(home)


class DiscoverNodesTest(unittest.TestCase):
    def test_nvm_and_fnm_layouts(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            nvm = make_node(home / "nvm" / "v20.11.1")
            make_node(home / "nvm" / "v18.19.0")
            fnm = make_node(home / "fnm" / "v21.7.3" / "installation")

            found = server.discover_nodes((home / "nvm", home / "fnm"))

            paths = [item["path"] for item in found]
            self.assertIn(str(nvm.resolve()), paths)
            self.assertIn(str(fnm.resolve()), paths)
            # 版本号新的排前面。
            self.assertEqual([item["version"] for item in found], ["21.7.3", "20.11.1", "18.19.0"])

    def test_skips_symlink_and_missing_node_binary(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            real = make_node(root / "v20.0.0")
            (root / "current").symlink_to(real)
            (root / "v19.0.0" / "bin").mkdir(parents=True)

            found = server.discover_nodes((root,))

            self.assertEqual([item["path"] for item in found], [str(real.resolve())])

    def test_missing_root_is_ignored(self):
        self.assertEqual(server.discover_nodes((Path("/nonexistent/nodex"),)), [])


class EffectiveNodeTest(unittest.TestCase):
    def test_existing_path_wins(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = make_node(Path(tmp) / "v20")
            self.assertEqual(server.effective_node(str(home)), str(home))

    def test_missing_path_falls_back_to_environment(self):
        self.assertEqual(server.effective_node("/nonexistent/nodex/node"), "")
        self.assertEqual(server.effective_node(""), "")


class BuildEnvTest(unittest.TestCase):
    def test_prepends_node_bin(self):
        base = {"PATH": "/usr/bin:/bin"}
        env = server.build_env("/opt/node", base)
        self.assertEqual(env["PATH"], "/opt/node/bin:/usr/bin:/bin")
        # 不动原来的环境字典。
        self.assertEqual(base["PATH"], "/usr/bin:/bin")

    def test_empty_node_keeps_environment(self):
        self.assertIsNone(server.build_env(""))


class NodeStoreTest(unittest.TestCase):
    def test_roundtrip_and_remove(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = server.NodeStore(Path(tmp) / "node.tsv")
            store.set("ws1", "/opt/node20")
            store.set("ws2", "/opt/node18")
            self.assertEqual(store.get("ws1"), "/opt/node20")
            self.assertEqual(store.get("ws2"), "/opt/node18")

            store.set("ws1", "")
            self.assertEqual(store.get("ws1"), "")
            store.set("ws2", "/opt/node18")
            store.remove("ws2")
            self.assertEqual(store.get("ws2"), "")

    def test_missing_file_reads_empty(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = server.NodeStore(Path(tmp) / "node.tsv")
            self.assertEqual(store.get("ws"), "")


class AttachNodesTest(unittest.TestCase):
    def test_marks_missing_node(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = server.NodeStore(Path(tmp) / "node.tsv")
            home = make_node(Path(tmp) / "v20")
            store.set("ok", str(home))
            store.set("gone", "/nonexistent/nodex/node")

            snapshot = {"workspaces": [{"id": "ok"}, {"id": "gone"}, {"id": "none"}]}
            out = server.attach_nodes(snapshot, store)

            self.assertEqual(out["workspaces"][0]["node"], str(home))
            self.assertFalse(out["workspaces"][0]["node_missing"])
            self.assertTrue(out["workspaces"][1]["node_missing"])
            self.assertEqual(out["workspaces"][2]["node"], "")


class SnapshotTest(unittest.TestCase):
    def test_scripts_services_and_latest_run(self):
        rows = [
            ["ws", "w1", "/tmp/demo", "1"],
            ["script", ".", "w1", "demo"],
            ["script", "packages/a", "w1", "@demo/a"],
            ["svc", "w1.dev.@demo/a", "w1", "dev", "/tmp/demo/packages/a", "packages/a",
             "run dev", "packages/a", "pnpm run dev", "pnpm"],
            ["run", "w1.dev.@demo/a.111", "w1", "dev", "@demo/a", "/tmp/demo/packages/a",
             "packages/a", "packages/a", "packages/a", "run dev", "pnpm run dev",
             "999", "5173", "ready", "1", "", ""],
            ["run", "w1.dev.@demo/a.222", "w1", "dev", "@demo/a", "/tmp/demo/packages/a",
             "packages/a", "packages/a", "packages/a", "run dev", "pnpm run dev",
             "1000", "", "starting", "2", "", ""],
        ]
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "state.tsv"
            path.write_text("\n".join(server.FS.join(r) for r in rows) + "\n", encoding="utf-8")
            snap = server.State(path).snapshot()

            ws = snap["workspaces"][0]
            self.assertEqual([p["rel"] for p in ws["scripts"]], [".", "packages/a"])
            self.assertEqual(ws["scripts"][0]["name"], "demo")
            svc = ws["services"][0]
            self.assertEqual(svc["pm"], "pnpm")
            self.assertEqual(svc["module"], "packages/a")
            # 同一服务跑过两次，只带最新那条。
            self.assertEqual(svc["run"]["id"], "w1.dev.@demo/a.222")
            self.assertEqual(svc["run"]["status"], "starting")


class AliasStoreTest(unittest.TestCase):
    def test_roundtrip_and_clear(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = server.AliasStore(Path(tmp) / "alias.tsv")
            store.set("w1", "  我的   工程 ")
            self.assertEqual(store.all(), {"w1": "我的 工程"})
            store.set("w1", "")
            self.assertEqual(store.all(), {})

    def test_too_long_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = server.AliasStore(Path(tmp) / "alias.tsv")
            with self.assertRaises(server.ApiError):
                store.set("w1", "x" * 81)

    def test_missing_file_reads_empty(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual(server.AliasStore(Path(tmp) / "alias.tsv").all(), {})


class AttachAliasTest(unittest.TestCase):
    def test_alias_and_rel(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "工程"
            root.mkdir()
            store = server.AliasStore(Path(tmp) / "alias.tsv")
            store.set("w1", "别名")
            snap = {
                "workspaces": [
                    {"id": "w1", "root": str(root)},
                    {"id": "w2", "root": "/nonexistent/x"},
                ]
            }
            server.attach_alias_rel(snap, store)
            self.assertEqual(snap["workspaces"][0]["alias"], "别名")
            self.assertEqual(snap["workspaces"][1]["alias"], "")
            self.assertEqual(
                snap["workspaces"][0]["rel"],
                os.path.relpath(str(root), os.path.expanduser("~")),
            )


def read_event(resp):
    event, data = "", ""
    while True:
        line = resp.readline()
        if not line:
            return event, data
        line = line.decode("utf-8").rstrip("\n")
        if line == "":
            return event, data
        if line.startswith("event:"):
            event = line[6:].strip()
        elif line.startswith("data:"):
            data += line[5:].strip()


class StateSseTest(unittest.TestCase):
    """状态文件一变就推一份，tick 也只跟着页面走。"""

    def test_pushes_when_state_file_changes(self):
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "state.tsv"
            path.write_text("one\n", encoding="utf-8")
            ticks = []
            stream = server.StateStream(
                [path],
                build=lambda: {"size": path.stat().st_size},
                tick=lambda: ticks.append(1),
            )
            stream.start()
            handler = type(
                "TestHandler",
                (server.Handler,),
                {"api_prefix": "/api", "static": Path(td), "state_stream": stream},
            )
            httpd = ThreadingHTTPServer(("127.0.0.1", 0), handler)
            httpd.daemon_threads = True
            threading.Thread(target=httpd.serve_forever, daemon=True).start()
            try:
                conn = http.client.HTTPConnection("127.0.0.1", httpd.server_address[1], timeout=10)
                conn.request("GET", "/api/state/stream")
                resp = conn.getresponse()
                self.assertEqual(resp.status, 200)
                self.assertEqual(resp.getheader("Content-Type"), "text/event-stream; charset=utf-8")

                event, data = read_event(resp)
                self.assertEqual(event, "state")
                self.assertEqual(json.loads(data)["size"], 4)

                stat = path.stat()
                path.write_text("one\ntwo\n", encoding="utf-8")
                os.utime(path, ns=(stat.st_atime_ns, stat.st_mtime_ns + 1000000))
                event, data = read_event(resp)
                self.assertEqual(event, "state")
                self.assertEqual(json.loads(data)["size"], 8)
                self.assertTrue(ticks)

                resp.close()
                conn.close()
            finally:
                httpd.shutdown()
                httpd.server_close()


class ZipHelpersTest(unittest.TestCase):
    """压缩栏用的几个纯函数：列目录、包名校验、条目去重。"""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name) / "proj"
        (root / "src").mkdir(parents=True)
        (root / "src" / "a.js").write_text("a", encoding="utf-8")
        (root / "node_modules" / "x").mkdir(parents=True)
        (root / "README.md").write_text("hi", encoding="utf-8")
        self.root = root.resolve()
        state = Path(self.tmp.name) / "state.tsv"
        state.write_text(server.FS.join(["ws", "w1", str(self.root), "1"]) + "\n", encoding="utf-8")
        self.state = server.State(state)

    def tearDown(self):
        self.tmp.cleanup()

    def test_entries_list_dirs_first_and_mark_excluded(self):
        data = server.list_entries(self.state, "w1", "")
        self.assertEqual([item["name"] for item in data["entries"]], ["node_modules", "src", "README.md"])
        self.assertEqual([item["name"] for item in data["entries"] if item["excluded"]], ["node_modules"])
        self.assertTrue(data["entries"][1]["dir"])
        nested = server.list_entries(self.state, "w1", "src")
        self.assertEqual([item["rel"] for item in nested["entries"]], ["src/a.js"])

    def test_entries_rejects_paths_outside_workspace(self):
        with self.assertRaises(server.ApiError):
            server.list_entries(self.state, "w1", "..")

    def test_zip_name_defaults_and_guards(self):
        self.assertEqual(server.zip_name(self.root, "")[0], "proj.zip")
        self.assertEqual(server.zip_name(self.root, "out")[0], "out.zip")
        with self.assertRaises(server.ApiError):
            server.zip_name(self.root, "../x.zip")

    def test_zip_entries_drops_covered_and_rejects_escape(self):
        picked = server.zip_entries(self.root, ["src", "README.md", "src/a.js"])
        self.assertEqual(picked, ["src", "README.md"])
        with self.assertRaises(server.ApiError):
            server.zip_entries(self.root, ["../x"])
        with self.assertRaises(server.ApiError):
            server.zip_entries(self.root, [])


if __name__ == "__main__":
    unittest.main()
