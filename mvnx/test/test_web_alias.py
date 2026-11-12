"""网页工作区别名与相对路径的回归测试。"""

import importlib.util
import os
import tempfile
import unittest
from pathlib import Path

SERVER = Path(__file__).resolve().parents[2] / "mvnx" / "lib" / "mvnx" / "web" / "server.py"

spec = importlib.util.spec_from_file_location("mvnx_web_server_alias", SERVER)
web = importlib.util.module_from_spec(spec)
spec.loader.exec_module(web)


class AliasStoreTest(unittest.TestCase):
    def test_roundtrip_and_clear(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = web.AliasStore(Path(tmp) / "alias.tsv")
            store.set("w1", "  我的   工程 ")
            self.assertEqual(store.all(), {"w1": "我的 工程"})
            store.set("w1", "")
            self.assertEqual(store.all(), {})

    def test_too_long_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = web.AliasStore(Path(tmp) / "alias.tsv")
            with self.assertRaises(web.ApiError):
                store.set("w1", "x" * 81)

    def test_missing_file_reads_empty(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = web.AliasStore(Path(tmp) / "alias.tsv")
            self.assertEqual(store.all(), {})


class AttachAliasTest(unittest.TestCase):
    def test_alias_and_rel(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "工程"
            root.mkdir()
            store = web.AliasStore(Path(tmp) / "alias.tsv")
            store.set("w1", "别名")
            snap = {
                "workspaces": [
                    {"id": "w1", "root": str(root)},
                    {"id": "w2", "root": "/nonexistent/x"},
                ]
            }
            web.attach_alias_rel(snap, store)
            self.assertEqual(snap["workspaces"][0]["alias"], "别名")
            self.assertEqual(snap["workspaces"][1]["alias"], "")
            self.assertEqual(
                snap["workspaces"][0]["rel"],
                os.path.relpath(str(root), os.path.expanduser("~")),
            )


if __name__ == "__main__":
    unittest.main(verbosity=2)
