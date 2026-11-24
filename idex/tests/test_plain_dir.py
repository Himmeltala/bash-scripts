"""普通目录的回归：不是 SVN 工作副本也不是 Git 仓库，照样能加，只按目录浏览。"""

import io
import sys
import tempfile
import unittest
import urllib.request
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
SERVER = HERE.parent / "src" / "idex" / "web" / "server.py"

sys.path.insert(0, str(HERE.parent.parent / "lib" / "py-shared" / "commons"))
sys.path.insert(0, str(HERE.parent.parent / "lib" / "py-shared" / "services"))
from testkit import json_call, load_module, serve

web = load_module("idex_web_server_plain", SERVER)
vcs_mod = load_module("idex_vcs_summary_plain", HERE.parent / "src" / "idex" / "web" / "vcs_summary.py")


class PlainDirTest(unittest.TestCase):
    def test_detect_returns_none(self):
        with tempfile.TemporaryDirectory() as td:
            Path(td, "readme.txt").write_text("hello", encoding="utf-8")
            kind, info = vcs_mod.detect_vcs(td)
            self.assertEqual(kind, "none")
            self.assertEqual(info, {"url": ""})

    def test_add_and_browse(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td) / "普通目录"
            root.mkdir()
            (root / "a.txt").write_text("hello", encoding="utf-8")
            store = web.Workspaces(Path(td) / "state.json")
            item = store.add(str(root))
            self.assertEqual(item["vcs"], "none")
            self.assertEqual(item["url"], "")

            handler = type(
                "TestHandler",
                (web.Handler,),
                {
                    "store": store,
                    "groups": web.LayoutStore(Path(td) / "groups.json"),
                },
            )
            with serve(handler, static=td, api_prefix="/api") as srv:
                base = "http://127.0.0.1:%s" % srv.port
                status, state = json_call(base, "/api/state")
                self.assertEqual(status, 200)
                self.assertEqual(state["workspaces"][0]["vcs"], "none")

                status, tree = json_call(base, "/api/tree?ws=%s" % item["id"])
                self.assertEqual(status, 200)
                self.assertIn("a.txt", [entry["name"] for entry in tree["entries"]])

    def test_download_dir_includes_dependency_dirs(self):
        # 打包下载跟浏览一样不过滤，node_modules 这类目录也要进压缩包。
        with tempfile.TemporaryDirectory() as td:
            root = Path(td) / "root"
            root.mkdir()
            (root / "a.txt").write_text("a\n", encoding="utf-8")
            (root / "node_modules").mkdir()
            (root / "node_modules" / "x.js").write_text("x\n", encoding="utf-8")
            store = web.Workspaces(Path(td) / "state.json")
            item = store.add(str(root))
            handler = type(
                "TestHandler",
                (web.Handler,),
                {"store": store, "groups": web.LayoutStore(Path(td) / "groups.json")},
            )
            with serve(handler, static=td, api_prefix="/api") as srv:
                url = "http://127.0.0.1:%s/api/download?ws=%s" % (srv.port, item["id"])
                with urllib.request.urlopen(url) as resp:
                    data = resp.read()
            names = zipfile.ZipFile(io.BytesIO(data)).namelist()
            self.assertIn("root/node_modules/x.js", names)

    def test_change_signature_sees_plain_dir_edits(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            (root / "a.txt").write_text("hello", encoding="utf-8")
            ws = {"vcs": "none", "root": td}
            sig1, count1, rev1 = vcs_mod.changes_signature(ws)
            self.assertIsNotNone(sig1)
            self.assertEqual(count1, 1)
            self.assertIsNone(rev1)
            self.assertEqual(vcs_mod.changes_signature(ws)[0], sig1)

            (root / "b.txt").write_text("new", encoding="utf-8")
            sig2, count2, _ = vcs_mod.changes_signature(ws)
            self.assertNotEqual(sig2, sig1)
            self.assertEqual(count2, 2)

            (root / "a.txt").write_text("hello world", encoding="utf-8")
            self.assertNotEqual(vcs_mod.changes_signature(ws)[0], sig2)


if __name__ == "__main__":
    unittest.main(verbosity=2)
