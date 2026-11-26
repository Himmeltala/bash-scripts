# @Author: Himmeltala
# @Date: 2026-11-26 09:29:54
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-26 09:29:54
# @FilePath: \idex\tests\test_node_engine.py
# @Description: Node 引擎状态解析与版本发现的回归测试。

import sys, unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src" / "idex"))
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "lib" / "py-shared" / "commons"))
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "lib" / "py-shared" / "services"))
from engines.node import engine

class NodeEngineTest(unittest.TestCase):
    def test_exports_state_and_engine(self):
        for name in ("State", "Engine", "state_payload", "NodeStore"):
            self.assertTrue(hasattr(engine, name), name)


if __name__ == "__main__":
    unittest.main()
