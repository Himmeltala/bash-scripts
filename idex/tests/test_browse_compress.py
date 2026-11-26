# @Author: Himmeltala
# @Date: 2026-11-26 09:29:54
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-26 09:29:54
# @FilePath: \idex\tests\test_browse_compress.py
# @Description: 资源管理器压缩与解压的回归测试。

import os, sys, tempfile, unittest
from pathlib import Path
from unittest import mock

REPO = Path(__file__).resolve().parents[2]
sys.path[:0] = [
    str(REPO / "lib" / "py-shared" / "commons"),
    str(REPO / "lib" / "py-shared" / "services"),
    str(REPO / "idex" / "src" / "idex" / "web"),
]
from web import ApiError, STREAMED
from routes_browse import BrowseRoutes, _browse_compress

class CompressTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name).resolve()
        self.src = self.root / "pkg"; self.src.mkdir(); (self.src / "a.txt").write_text("x")
        self.handler = type("H", (), {})()
        self.handler._check_write = lambda: None
        self.handler.store = type("S", (), {"find": lambda self_, wid: {"id": wid, "root": str(self.root)}})()

    def make_zipx(self, body='touch "$4"'):
        """假 zipx：记下 PWD 与 argv，再按给定脚本动作。"""
        fake = Path(self.tmp.name) / "zipx"
        recorder = Path(self.tmp.name) / "rec"
        recorder.mkdir(exist_ok=True)
        script = (
            "#!/bin/sh\n"
            f"printf '%s\\n' \"$PWD\" > '{recorder}/cwd'\n"
            f"printf '%s\\n' \"$@\" > '{recorder}/argv'\n"
            f"{body}\n"
        )
        fake.write_text(script, encoding="utf-8"); fake.chmod(0o755)
        return str(fake), recorder

    def test_packs_sibling_zip(self):
        fake, recorder = self.make_zipx()
        with mock.patch("routes_browse.zipx_command", return_value=fake):
            out = _browse_compress(self.handler, {"ws": "i1", "path": "pkg"})
        self.assertEqual(out["path"], "pkg.zip")
        self.assertEqual(out["size"], 0)
        self.assertTrue((self.root / "pkg.zip").exists())
        self.assertEqual((recorder / "cwd").read_text().strip(), str(self.root))
        self.assertEqual(
            (recorder / "argv").read_text().splitlines(),
            ["pack", "pkg", "-o", str(self.root / "pkg.zip")],
        )

    def test_trailing_slash_and_dot_are_normalized(self):
        for path in ("pkg/", "pkg/."):
            fake, _ = self.make_zipx()
            (self.root / "pkg.zip").unlink(missing_ok=True)
            with mock.patch("routes_browse.zipx_command", return_value=fake):
                out = _browse_compress(self.handler, {"ws": "i1", "path": path})
            self.assertEqual(out["path"], "pkg.zip", path)
            self.assertTrue((self.root / "pkg.zip").exists(), path)

    def test_existing_archive_is_409(self):
        (self.root / "pkg.zip").write_text("old")
        with mock.patch("routes_browse.zipx_command") as cmd:
            with self.assertRaises(ApiError) as ctx:
                _browse_compress(self.handler, {"ws": "i1", "path": "pkg"})
        self.assertEqual(ctx.exception.status, 409)
        cmd.assert_not_called()

    def test_broken_symlink_archive_is_409(self):
        (self.root / "pkg.zip").symlink_to(self.root / "missing.zip")
        with mock.patch("routes_browse.zipx_command") as cmd:
            with self.assertRaises(ApiError) as ctx:
                _browse_compress(self.handler, {"ws": "i1", "path": "pkg"})
        self.assertEqual(ctx.exception.status, 409)
        cmd.assert_not_called()

    def test_rejects_file_and_outside_path(self):
        (self.root / "a.txt").write_text("x")
        for path in ("a.txt", "../outside"):
            with self.assertRaises(ApiError):
                _browse_compress(self.handler, {"ws": "i1", "path": path})

    def test_rejects_empty_and_dot(self):
        for path in ("", ".", "./"):
            with self.assertRaises(ApiError) as ctx:
                _browse_compress(self.handler, {"ws": "i1", "path": path})
            self.assertEqual(ctx.exception.status, 400)

    def test_missing_zipx_is_503(self):
        with mock.patch("routes_browse.zipx_command", return_value=None):
            with self.assertRaises(ApiError) as ctx:
                _browse_compress(self.handler, {"ws": "i1", "path": "pkg"})
        self.assertEqual(ctx.exception.status, 503)
        self.assertIn("zipx", ctx.exception.message)

    def test_zipx_failure_is_400_with_stderr(self):
        fake, _ = self.make_zipx('echo "boom" >&2; exit 1')
        with mock.patch("routes_browse.zipx_command", return_value=fake):
            with self.assertRaises(ApiError) as ctx:
                _browse_compress(self.handler, {"ws": "i1", "path": "pkg"})
        self.assertEqual(ctx.exception.status, 400)
        self.assertIn("boom", ctx.exception.message)

    def test_failure_removes_partial_archive(self):
        fake, _ = self.make_zipx(': > "$4"; echo "boom" >&2; exit 1')
        with mock.patch("routes_browse.zipx_command", return_value=fake):
            with self.assertRaises(ApiError):
                _browse_compress(self.handler, {"ws": "i1", "path": "pkg"})
        self.assertFalse((self.root / "pkg.zip").exists())

    def test_timeout_removes_partial_archive(self):
        fake, _ = self.make_zipx(': > "$4"; exec sleep 5')
        with mock.patch("routes_browse.zipx_command", return_value=fake):
            with mock.patch("routes_browse.COMPRESS_TIMEOUT", 0.2):
                with self.assertRaises(ApiError) as ctx:
                    _browse_compress(self.handler, {"ws": "i1", "path": "pkg"})
        self.assertEqual(ctx.exception.status, 504)
        self.assertFalse((self.root / "pkg.zip").exists())

    def test_zipx_success_without_archive_is_400(self):
        fake, _ = self.make_zipx("exit 0")
        with mock.patch("routes_browse.zipx_command", return_value=fake):
            with self.assertRaises(ApiError) as ctx:
                _browse_compress(self.handler, {"ws": "i1", "path": "pkg"})
        self.assertEqual(ctx.exception.status, 400)
        self.assertIn("没有生成包文件", ctx.exception.message)
        self.assertFalse((self.root / "pkg.zip").exists())

    def test_directory_download_uses_zipx(self):
        """下载目录与「压缩」共用 zipx，包只走临时文件，不落到工作区里。"""
        fake, recorder = self.make_zipx()
        sent = {}
        handler = type("H", (), {})()
        handler._ws = lambda query: {"id": "i1", "root": str(self.root)}
        handler._send_download = lambda path, name, head=False: sent.update(
            path=path, name=name, exists=Path(path).exists()
        )
        with mock.patch("routes_browse.zipx_command", return_value=fake):
            result = BrowseRoutes._download(handler, {"path": ["pkg"]})
        self.assertIs(result, STREAMED)
        self.assertEqual(sent["name"], "pkg.zip")
        self.assertTrue(sent["exists"])
        self.assertEqual((recorder / "cwd").read_text().strip(), str(self.root))
        self.assertEqual((recorder / "argv").read_text().splitlines()[:2], ["pack", "pkg"])
        self.assertFalse(Path(sent["path"]).exists())
        self.assertFalse((self.root / "pkg.zip").exists())

    def test_exec_failure_is_503(self):
        """zipx_command 指到不能执行的路径时，起进程的 OSError 要变成明确的 503。"""
        with mock.patch("routes_browse.zipx_command", return_value=self.tmp.name):
            with self.assertRaises(ApiError) as ctx:
                _browse_compress(self.handler, {"ws": "i1", "path": "pkg"})
        self.assertEqual(ctx.exception.status, 503)
        self.assertIn("zipx", ctx.exception.message)


if __name__ == "__main__":
    unittest.main(verbosity=2)
