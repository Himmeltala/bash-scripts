"""会话清单、账本聚合与移进回收目录。"""

import os
import sys
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from unittest import mock
from zoneinfo import ZoneInfo

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "lib" / "py-shared" / "commons"))
sys.path.insert(0, str(REPO / "lib" / "py-shared" / "services"))
sys.path.insert(0, str(REPO / "llmx" / "src"))

import testkit

from llmx import config as llmx_config
from llmx import sessions as llmx_sessions
from llmx import web as llmx_web
from llmx.model import Record, Usage
from llmx.store import Store

AT = datetime(2026, 1, 1, 3, 0, tzinfo=ZoneInfo("Asia/Shanghai"))


class SessionApiTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.home = Path(self._tmp.name)
        env = {key: value for key, value in os.environ.items() if not key.startswith("LLMX_")}
        env.update({"HOME": str(self.home), "XDG_CACHE_HOME": str(self.home / "cache")})
        patcher = mock.patch.dict(os.environ, env, clear=True)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.config = llmx_config.load()
        self.server = testkit.serve(llmx_web._make_handler(self.config), api_prefix="/api")
        self.addCleanup(self.server.shutdown)

    @property
    def projects(self):
        return self.home / ".claude" / "projects"

    def write(self, *parts, text="{}\n", size=None):
        path = self.projects.joinpath(*parts)
        path.parent.mkdir(parents=True, exist_ok=True)
        if size is None:
            path.write_text(text, encoding="utf-8")
        else:
            path.write_text("x" * size, encoding="utf-8")
        return path

    def seed(self, rows):
        batches: dict[str, dict[str, list[Record]]] = {"claude": {}}
        for index, (session, project, tokens) in enumerate(rows):
            batches["claude"].setdefault(session, []).append(
                Record(
                    source="claude",
                    session=session,
                    at=AT,
                    model="deepseek-flash",
                    project=project,
                    usage=Usage(input=tokens),
                    key=f"k{index}",
                )
            )
        with Store(self.config.store.db, self.config.book.tz) as store:
            store.insert(batches)

    def list(self):
        status, body = testkit.json_call(self.server.base, "/claude/sessions")
        self.assertEqual(status, 200)
        return body, {row["id"]: row for row in body["sessions"]}

    def test_list_groups_subagent_files_and_joins_ledger(self):
        self.write("p1", "sess-a.jsonl", size=10)
        self.write("p1", "sess-a", "subagents", "agent-1.jsonl", size=20)
        self.write("p2", "sess-b.jsonl", size=5)
        self.seed([("sess-a", "/home/debian/demo", 1_000_000), ("sess-b", "/home/debian/demo", 2)])

        body, rows = self.list()
        self.assertEqual(sorted(rows), ["sess-a", "sess-b"])
        a = rows["sess-a"]
        self.assertEqual(len(a["files"]), 2)
        self.assertEqual(a["size"], 30)
        self.assertEqual(a["requests"], 1)
        self.assertEqual(a["total_tokens"], 1_000_000)
        self.assertGreater(a["cost"], 0)
        self.assertEqual(a["project"], "demo")
        self.assertTrue(a["started"])
        self.assertTrue(body["garbage"].endswith("garbage/claude"))

    def test_detail_lists_model_rows(self):
        self.write("p1", "sess-a.jsonl")
        self.seed([("sess-a", "/home/debian/demo", 1_000_000)])
        status, body = testkit.json_call(
            self.server.base, "/claude/sessions/detail?id=sess-a"
        )
        self.assertEqual(status, 200)
        self.assertEqual(len(body["rows"]), 1)
        self.assertEqual(body["rows"][0]["model"], "deepseek-flash")
        self.assertEqual(body["rows"][0]["total_tokens"], 1_000_000)
        self.assertEqual(body["files"], [str(self.projects / "p1" / "sess-a.jsonl")])

        status, body = testkit.json_call(
            self.server.base, "/claude/sessions/detail?id=nope"
        )
        self.assertEqual(status, 400)

    def test_delete_moves_files_to_garbage_and_keeps_ledger(self):
        first = self.write("p1", "sess-a.jsonl")
        second = self.write("p1", "sess-a", "subagents", "agent-1.jsonl")
        self.write("p2", "sess-b.jsonl")
        self.seed([("sess-a", "/home/debian/demo", 10), ("sess-b", "/home/debian/demo", 10)])

        status, body = testkit.json_call(
            self.server.base, "/claude/sessions/delete", {"ids": ["sess-a"]}
        )
        self.assertEqual(status, 200)
        self.assertEqual(body["moved"], 2)
        self.assertFalse(first.exists())
        self.assertFalse(second.exists())
        targets = [Path(item["to"]) for item in body["files"]]
        garbage = Path(body["garbage"])
        self.assertTrue(all(path.name.endswith(".jsonl") for path in targets))
        # 一批一个时间戳目录，里面保持原来的项目/会话相对路径。
        batches = {path.relative_to(garbage).parts[0] for path in targets}
        self.assertEqual(len(batches), 1)
        self.assertRegex(batches.pop(), r"^\d{8}-\d{6}(-\d+)?$")
        rels = sorted(path.relative_to(garbage).as_posix().split("/", 1)[1] for path in targets)
        self.assertEqual(rels, ["p1/sess-a.jsonl", "p1/sess-a/subagents/agent-1.jsonl"])

        body, rows = self.list()
        self.assertEqual(sorted(rows), ["sess-b"])

        with Store(self.config.store.db, self.config.book.tz) as store:
            self.assertEqual(store.stats()["requests"], 2)

    def test_garbage_lists_moved_files(self):
        self.write("p1", "sess-a.jsonl", size=12)
        # 还没移走时回收站是空的。
        status, body = testkit.json_call(self.server.base, "/claude/sessions/garbage")
        self.assertEqual(status, 200)
        self.assertEqual(body["files"], [])

        testkit.json_call(self.server.base, "/claude/sessions/delete", {"ids": ["sess-a"]})
        status, body = testkit.json_call(self.server.base, "/claude/sessions/garbage")
        self.assertEqual(status, 200)
        self.assertEqual(len(body["files"]), 1)
        row = body["files"][0]
        self.assertEqual(row["name"], "sess-a")
        self.assertEqual(row["project"], "p1")
        self.assertEqual(row["files"], 1)
        self.assertTrue(row["restorable"])
        self.assertEqual(row["size"], 12)
        self.assertRegex(row["moved"], r"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$")
        self.assertEqual(Path(body["dir"]).name, "claude")

    def test_missing_session_is_ignored(self):
        status, body = testkit.json_call(
            self.server.base, "/claude/sessions/delete", {"ids": ["gone"]}
        )
        self.assertEqual(status, 200)
        self.assertEqual(body["moved"], 0)
        status, _ = testkit.json_call(self.server.base, "/claude/sessions/delete", {"ids": []})
        self.assertEqual(status, 400)

    def test_same_name_files_get_suffix(self):
        first = self.write("p1", "sess-x.jsonl")
        second = self.write("p2", "sess-x.jsonl")
        status, body = testkit.json_call(
            self.server.base, "/claude/sessions/delete", {"ids": ["sess-x"]}
        )
        self.assertEqual(status, 200)
        self.assertEqual(body["moved"], 2)
        garbage = Path(body["garbage"])
        rels = {Path(item["to"]).relative_to(garbage).as_posix().split("/", 1)[1] for item in body["files"]}
        self.assertEqual(rels, {"p1/sess-x.jsonl", "p2/sess-x.jsonl"})
        self.assertFalse(first.exists())
        self.assertFalse(second.exists())

    def test_restore_moves_files_back(self):
        first = self.write("p1", "sess-a.jsonl")
        second = self.write("p1", "sess-a", "subagents", "agent-1.jsonl")
        testkit.json_call(self.server.base, "/claude/sessions/delete", {"ids": ["sess-a"]})
        _, body = testkit.json_call(self.server.base, "/claude/sessions/garbage")
        key = body["files"][0]["id"]

        status, data = testkit.json_call(
            self.server.base, "/claude/sessions/restore", {"ids": [key]}
        )
        self.assertEqual(status, 200, data)
        self.assertEqual(data["restored"], 2)
        self.assertTrue(first.exists())
        self.assertTrue(second.exists())
        _, body = testkit.json_call(self.server.base, "/claude/sessions/garbage")
        self.assertEqual(body["files"], [])

    def test_restore_refuses_to_overwrite(self):
        path = self.write("p1", "sess-a.jsonl")
        testkit.json_call(self.server.base, "/claude/sessions/delete", {"ids": ["sess-a"]})
        _, body = testkit.json_call(self.server.base, "/claude/sessions/garbage")
        key = body["files"][0]["id"]
        # 原位置又出现了同名文件，撤回要整批拒绝。
        path.write_text("{}\n", encoding="utf-8")
        status, data = testkit.json_call(
            self.server.base, "/claude/sessions/restore", {"ids": [key]}
        )
        self.assertEqual(status, 400)
        self.assertTrue(path.exists())
        _, body = testkit.json_call(self.server.base, "/claude/sessions/garbage")
        self.assertEqual(len(body["files"]), 1)

    def test_purge_removes_files_for_good(self):
        path = self.write("p1", "sess-a.jsonl")
        testkit.json_call(self.server.base, "/claude/sessions/delete", {"ids": ["sess-a"]})
        _, body = testkit.json_call(self.server.base, "/claude/sessions/garbage")
        key = body["files"][0]["id"]

        status, data = testkit.json_call(
            self.server.base, "/claude/sessions/purge", {"ids": [key]}
        )
        self.assertEqual(status, 200, data)
        self.assertEqual(data["removed"], 1)
        self.assertFalse(path.exists())
        _, body = testkit.json_call(self.server.base, "/claude/sessions/garbage")
        self.assertEqual(body["files"], [])

    def test_old_flat_garbage_cannot_be_restored(self):
        garbage = Path(self.home / "cache" / "llmx" / "garbage" / "claude")
        garbage.mkdir(parents=True)
        (garbage / "sess-old-20260101-030000.jsonl").write_text("{}\n", encoding="utf-8")
        _, body = testkit.json_call(self.server.base, "/claude/sessions/garbage")
        row = body["files"][0]
        self.assertFalse(row["restorable"])
        status, _ = testkit.json_call(
            self.server.base, "/claude/sessions/restore", {"ids": [row["id"]]}
        )
        self.assertEqual(status, 400)

    def test_symlink_outside_projects_is_refused(self):
        outside = self.home / "outside.jsonl"
        outside.write_text("{}\n", encoding="utf-8")
        link = self.projects / "p1" / "sess-link.jsonl"
        link.parent.mkdir(parents=True)
        link.symlink_to(outside)
        with self.assertRaises(llmx_sessions.SessionError):
            llmx_sessions.trash(self.config, ["sess-link"])
        self.assertTrue(outside.is_file())


if __name__ == "__main__":
    unittest.main(verbosity=2)
