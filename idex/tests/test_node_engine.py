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
