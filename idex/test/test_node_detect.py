# idex/test/test_node_detect.py
import subprocess, tempfile, unittest
from pathlib import Path

ENGINE = Path(__file__).resolve().parents[1] / "lib" / "idex" / "engines" / "node" / "engine.sh"

class DetectTest(unittest.TestCase):
    def test_prints_workspace_root(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "app"; (root / "packages" / "web").mkdir(parents=True)
            (root / "package.json").write_text('{"workspaces": ["packages/*"]}', encoding="utf-8")
            (root / "packages" / "web" / "package.json").write_text("{}", encoding="utf-8")
            done = subprocess.run(["bash", str(ENGINE), "--detect", str(root / "packages" / "web")],
                                  capture_output=True, text=True)
            self.assertEqual(done.returncode, 0, done.stderr)
            self.assertEqual(done.stdout.strip(), str(root.resolve()))

    def test_rejects_plain_dir(self):
        with tempfile.TemporaryDirectory() as tmp:
            done = subprocess.run(["bash", str(ENGINE), "--detect", tmp], capture_output=True, text=True)
            self.assertEqual(done.returncode, 4)
            self.assertIn("package.json", done.stderr)
            self.assertEqual(done.stdout, "")


if __name__ == "__main__":
    unittest.main()
