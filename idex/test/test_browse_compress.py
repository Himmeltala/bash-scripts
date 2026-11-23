import os, sys, tempfile, unittest
from pathlib import Path
from unittest import mock

REPO = Path(__file__).resolve().parents[2]
sys.path[:0] = [
    str(REPO / "lib" / "py-shared" / "commons"),
    str(REPO / "lib" / "py-shared" / "services"),
    str(REPO / "idex" / "lib" / "idex" / "web"),
]
from web import ApiError
from routes_browse import _browse_compress

class CompressTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name).resolve()
        self.src = self.root / "pkg"; self.src.mkdir(); (self.src / "a.txt").write_text("x")
        self.handler = type("H", (), {})()
        self.handler._check_write = lambda: None
        self.handler.store = type("S", (), {"find": lambda self_, wid: {"id": wid, "root": str(self.root)}})()

    def test_packs_sibling_zip(self):
        fake = Path(self.tmp.name) / "zipx"
        fake.write_text(f"#!/bin/sh\ntouch \"$4\"\n", encoding="utf-8"); fake.chmod(0o755)
        with mock.patch("routes_browse.zipx_command", return_value=str(fake)):
            out = _browse_compress(self.handler, {"ws": "i1", "path": "pkg"})
        self.assertEqual(out["path"], "pkg.zip")
        self.assertTrue((self.root / "pkg.zip").exists())

    def test_existing_archive_is_409(self):
        (self.root / "pkg.zip").write_text("old")
        with self.assertRaises(ApiError) as ctx:
            _browse_compress(self.handler, {"ws": "i1", "path": "pkg"})
        self.assertEqual(ctx.exception.status, 409)

    def test_rejects_file_and_outside_path(self):
        (self.root / "a.txt").write_text("x")
        for path in ("a.txt", "../outside"):
            with self.assertRaises(ApiError):
                _browse_compress(self.handler, {"ws": "i1", "path": path})


if __name__ == "__main__":
    unittest.main(verbosity=2)
