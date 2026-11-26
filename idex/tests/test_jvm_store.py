# @Author: Himmeltala
# @Date: 2026-11-26 09:29:54
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-26 09:29:54
# @FilePath: \idex\tests\test_jvm_store.py
# @Description: 旧版分组迁移：state.json 里的 groups 在启动时挪到 groups.json。

"""旧版分组迁移：state.json 里的 groups 在启动时挪到 groups.json。"""

import sys
import tempfile
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "lib" / "py-shared" / "commons"))
sys.path.insert(0, str(REPO / "lib" / "py-shared" / "services"))
sys.path.insert(0, str(REPO / "idex" / "src" / "idex"))

from fileio import read_json, write_json
from engines.jvm.engine import App
from engines.jvm.store import KIND_MVN


class GroupMigrationTest(unittest.TestCase):
    def test_legacy_groups_move_to_groups_json(self):
        with tempfile.TemporaryDirectory() as td:
            home = Path(td)
            write_json(
                home / "state.json",
                {
                    "workspaces": [],
                    "groups": [{"kind": "group", "id": "g1", "name": "前端", "parent": ""}],
                },
            )
            app = App(home)
            self.assertEqual([node["id"] for node in app.groups.nodes()], ["g1"])
            self.assertNotIn("groups", read_json(home / "state.json", default={}))

    def test_forget_workspace_drops_its_group_node(self):
        with tempfile.TemporaryDirectory() as td:
            app = App(Path(td))
            ws = app.store.add(str(Path(td)), KIND_MVN)
            app.groups.set(
                [
                    {"kind": "group", "id": "g1", "name": "组", "parent": ""},
                    {"kind": "ws", "id": ws["id"], "parent": "g1"},
                ]
            )
            app.forget_workspace(ws["id"])
            self.assertEqual([node["id"] for node in app.groups.nodes()], ["g1"])


if __name__ == "__main__":
    unittest.main()
