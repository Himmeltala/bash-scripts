# @Author: Himmeltala
# @Date: 2026-11-26 09:29:54
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-26 09:29:54
# @FilePath: \idex\tests\test_web_tool_detect.py
# @Description: 工具能力探测：Node 与 JVM 各自的根与 id，失败时只省略对应项。

import sys, tempfile, unittest
from pathlib import Path
from unittest import mock

REPO = Path(__file__).resolve().parents[2]
sys.path[:0] = [
    str(REPO / "lib" / "py-shared" / "commons"),
    str(REPO / "lib" / "py-shared" / "services"),
    str(REPO / "idex" / "src" / "idex"),
    str(REPO / "idex" / "src" / "idex" / "web"),
]
from tool_detect import detect_tools

class DetectToolsTest(unittest.TestCase):
    def _engine(self, tmp, body):
        path = Path(tmp) / "engine.sh"
        path.write_text("#!/bin/sh\n" + body, encoding="utf-8")
        path.chmod(0o755)
        return str(path)

    def test_node_probe_sets_root_and_id(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = str(Path(tmp).resolve())
            tools = detect_tools(root, node_engine=self._engine(tmp, f"printf '%s\\n' '{root}'\n"))
            self.assertEqual(tools["node"]["root"], root)
            self.assertEqual(len(tools["node"]["id"]), 12)

    def test_jvm_probe_uses_detect_project(self):
        with tempfile.TemporaryDirectory() as tmp:
            with mock.patch("tool_detect.detect_project", return_value=("/ws", "mvn")):
                tools = detect_tools(tmp, node_engine=self._engine(tmp, "exit 4\n"))
            self.assertEqual(tools["jvm"]["kind"], "mvn")
            self.assertEqual(tools["jvm"]["root"], "/ws")

    def test_failures_are_omitted(self):
        with tempfile.TemporaryDirectory() as tmp:
            with mock.patch("tool_detect.detect_project", side_effect=Exception("no")):
                self.assertEqual(detect_tools(tmp, node_engine=self._engine(tmp, "exit 4\n")), {})


if __name__ == "__main__":
    unittest.main()
