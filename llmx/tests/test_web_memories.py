"""Claude Code 项目持久记忆的网页读写与路径限制。"""

import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "lib" / "py-shared" / "commons"))
sys.path.insert(0, str(REPO / "lib" / "py-shared" / "services"))
sys.path.insert(0, str(REPO / "llmx" / "src"))

import testkit

from llmx import config as llmx_config
from llmx import web as llmx_web


class MemoriesApiTest(unittest.TestCase):
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

    def write(self, project, name, text):
        path = self.projects / project / "memory" / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
        return path

    def test_list_groups_projects_and_puts_index_first(self):
        self.write("proj-a", "zeta.md", "z")
        self.write("proj-a", "MEMORY.md", "index")
        (self.projects / "proj-b").mkdir(parents=True)

        status, body = testkit.json_call(self.server.base, "/claude/memories")
        self.assertEqual(status, 200)
        self.assertEqual([item["id"] for item in body["projects"]], ["proj-a"])
        names = [item["name"] for item in body["projects"][0]["files"]]
        self.assertEqual(names, ["MEMORY.md", "zeta.md"])
        self.assertTrue(body["projects"][0]["files"][1]["size"] > 0)

    def test_read_and_write_file(self):
        status, body = testkit.json_call(
            self.server.base, "/claude/memories?project=proj-a&name=note.md"
        )
        self.assertEqual(status, 200)
        self.assertFalse(body["exists"])
        self.assertEqual(body["text"], "")

        status, body = testkit.json_call(
            self.server.base,
            "/claude/memories",
            {"project": "proj-a", "name": "note.md", "text": "# 记一笔\n"},
        )
        self.assertEqual(status, 200, body)
        path = self.projects / "proj-a" / "memory" / "note.md"
        self.assertEqual(path.read_text(encoding="utf-8"), "# 记一笔\n")
        self.assertEqual(body["size"], len("# 记一笔\n".encode("utf-8")))

        _, body = testkit.json_call(
            self.server.base, "/claude/memories?project=proj-a&name=note.md"
        )
        self.assertTrue(body["exists"])
        self.assertEqual(body["text"], "# 记一笔\n")

    def test_path_traversal_is_refused(self):
        self.write("proj-a", "ok.md", "ok")
        for project, name in (("..", "ok.md"), ("proj-a", "../ok.md"), ("proj-a", "ok.txt")):
            status, _ = testkit.json_call(
                self.server.base, f"/claude/memories?project={project}&name={name}"
            )
            self.assertEqual(status, 400, (project, name))

    def test_symlink_outside_memory_is_refused(self):
        outside = self.home / "outside.md"
        outside.write_text("secret", encoding="utf-8")
        memory = self.projects / "proj-a" / "memory"
        memory.mkdir(parents=True)
        (memory / "link.md").symlink_to(outside)
        status, _ = testkit.json_call(
            self.server.base, "/claude/memories?project=proj-a&name=link.md"
        )
        self.assertEqual(status, 400)


if __name__ == "__main__":
    unittest.main()
