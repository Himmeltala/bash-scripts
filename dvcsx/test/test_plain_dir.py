"""普通目录的回归：不是 SVN 工作副本也不是 Git 仓库，照样能加，只按目录浏览。"""

import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
SERVER = HERE.parent / "lib" / "dvcsx" / "web" / "server.py"

sys.path.insert(0, str(HERE.parent.parent / "lib" / "py-shared"))
from testkit import json_call, load_module, serve

web = load_module("dvcsx_web_server_plain", SERVER)


class PlainDirTest(unittest.TestCase):
    def test_detect_returns_none(self):
        with tempfile.TemporaryDirectory() as td:
            Path(td, "readme.txt").write_text("hello", encoding="utf-8")
            vcs, info = web.detect_vcs(td)
            self.assertEqual(vcs, "none")
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

    def test_change_signature_skips_plain_dir(self):
        self.assertEqual(web.changes_signature({"vcs": "none", "root": "/tmp"}), (None, 0, None))


if __name__ == "__main__":
    unittest.main(verbosity=2)
