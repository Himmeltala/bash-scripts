"""nodex 网页端：Node 版本发现、按工作区保存与环境拼装，以及状态快照。"""

import importlib.util
import os
import tempfile
import unittest
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
    def test_packages_services_and_latest_run(self):
        rows = [
            ["ws", "w1", "/tmp/demo", "1"],
            ["pkg", ".", "w1", "demo"],
            ["pkg", "packages/a", "w1", "@demo/a"],
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
            self.assertEqual([p["rel"] for p in ws["packages"]], [".", "packages/a"])
            self.assertEqual(ws["packages"][0]["name"], "demo")
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


if __name__ == "__main__":
    unittest.main()
