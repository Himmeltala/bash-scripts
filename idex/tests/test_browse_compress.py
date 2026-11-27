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
from routes_browse import (
    BrowseRoutes,
    _browse_compress,
    _browse_compress_selection,
    _browse_delete_selection,
    _browse_download_selection,
    _browse_extract,
)

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

    def make_archive(self, name="bundle.zip"):
        archive = self.root / name
        archive.write_text("x")
        return archive

    def test_extracts_to_sibling_dir(self):
        self.make_archive()
        fake, recorder = self.make_zipx('mkdir -p "$4"')
        with mock.patch("routes_browse.zipx_command", return_value=fake):
            out = _browse_extract(self.handler, {"ws": "i1", "path": "bundle.zip"})
        self.assertEqual(out["path"], "bundle")
        self.assertTrue((self.root / "bundle").is_dir())
        self.assertEqual((recorder / "cwd").read_text().strip(), str(self.root))
        self.assertEqual(
            (recorder / "argv").read_text().splitlines(),
            ["unpack", "bundle.zip", "-d", str(self.root / "bundle")],
        )

    def test_existing_target_is_409(self):
        self.make_archive()
        (self.root / "bundle").mkdir()
        with mock.patch("routes_browse.zipx_command") as cmd:
            with self.assertRaises(ApiError) as ctx:
                _browse_extract(self.handler, {"ws": "i1", "path": "bundle.zip"})
        self.assertEqual(ctx.exception.status, 409)
        cmd.assert_not_called()

    def test_rejects_non_zip_and_dirs(self):
        (self.root / "a.txt").write_text("x")
        (self.root / "plain.zip.txt").write_text("x")
        for path in ("pkg", "a.txt", "plain.zip.txt", "", ".", "../x.zip", "missing.zip"):
            with self.assertRaises(ApiError, msg=path) as ctx:
                _browse_extract(self.handler, {"ws": "i1", "path": path})
            self.assertEqual(ctx.exception.status, 400, path)

    def test_missing_zipx_is_503(self):
        self.make_archive()
        with mock.patch("routes_browse.zipx_command", return_value=None):
            with self.assertRaises(ApiError) as ctx:
                _browse_extract(self.handler, {"ws": "i1", "path": "bundle.zip"})
        self.assertEqual(ctx.exception.status, 503)

    def test_failure_removes_partial_dir(self):
        self.make_archive()
        fake, _ = self.make_zipx('mkdir -p "$4"; echo "boom" >&2; exit 1')
        with mock.patch("routes_browse.zipx_command", return_value=fake):
            with self.assertRaises(ApiError) as ctx:
                _browse_extract(self.handler, {"ws": "i1", "path": "bundle.zip"})
        self.assertEqual(ctx.exception.status, 400)
        self.assertIn("boom", ctx.exception.message)
        self.assertFalse((self.root / "bundle").exists())

    def test_timeout_removes_partial_dir(self):
        self.make_archive()
        fake, _ = self.make_zipx('mkdir -p "$4"; exec sleep 5')
        with mock.patch("routes_browse.zipx_command", return_value=fake):
            with mock.patch("routes_browse.COMPRESS_TIMEOUT", 0.2):
                with self.assertRaises(ApiError) as ctx:
                    _browse_extract(self.handler, {"ws": "i1", "path": "bundle.zip"})
        self.assertEqual(ctx.exception.status, 504)
        self.assertFalse((self.root / "bundle").exists())




class SelectionTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name).resolve()
        (self.root / "a.txt").write_text("x")
        (self.root / "d").mkdir()
        (self.root / "d" / "inside.txt").write_text("x")
        (self.root / "other").mkdir()
        self.handler = type("H", (), {})()
        self.handler._check_write = lambda: None
        self.handler.store = type("S", (), {
            "find": lambda self_, wid: {"id": wid, "root": str(self.root), "vcs": "none"},
        })()

    def make_zipx(self, body='for a in "$@"; do last=$a; done; : > "$last"'):
        fake = Path(self.tmp.name) / "zipx"
        recorder = Path(self.tmp.name) / "rec"
        recorder.mkdir(exist_ok=True)
        fake.write_text(
            "#!/bin/sh\n"
            f"printf '%s\\n' \"$PWD\" > '{recorder}/cwd'\n"
            f"printf '%s\\n' \"$@\" > '{recorder}/argv'\n"
            f"{body}\n",
            encoding="utf-8",
        )
        fake.chmod(0o755)
        return str(fake), recorder

    def test_compress_selection_packs_mixed_entries(self):
        fake, recorder = self.make_zipx()
        with mock.patch("routes_browse.zipx_command", return_value=fake):
            out = _browse_compress_selection(
                self.handler, {"ws": "i1", "paths": ["a.txt", "d"]}
            )
        self.assertTrue(out["path"].endswith("-选中.zip"), out["path"])
        self.assertEqual((recorder / "cwd").read_text().strip(), str(self.root))
        self.assertEqual(
            (recorder / "argv").read_text().splitlines(),
            ["pack", "a.txt", "d", "-o", str(self.root / out["path"])],
        )

    def test_compress_single_keeps_name(self):
        fake, _ = self.make_zipx()
        with mock.patch("routes_browse.zipx_command", return_value=fake):
            out = _browse_compress_selection(self.handler, {"ws": "i1", "paths": ["d"]})
        self.assertEqual(out["path"], "d.zip")

    def test_compress_selection_rejects_other_parents_and_missing(self):
        with mock.patch("routes_browse.zipx_command") as cmd:
            with self.assertRaises(ApiError) as ctx:
                _browse_compress_selection(
                    self.handler, {"ws": "i1", "paths": ["a.txt", "d/inside.txt"]}
                )
            self.assertEqual(ctx.exception.status, 400)
            with self.assertRaises(ApiError) as ctx:
                _browse_compress_selection(self.handler, {"ws": "i1", "paths": ["missing.txt"]})
            self.assertEqual(ctx.exception.status, 404)
            with self.assertRaises(ApiError):
                _browse_compress_selection(self.handler, {"ws": "i1", "paths": []})
        cmd.assert_not_called()

    def test_compress_selection_existing_archive_is_409(self):
        parent_name = self.root.name
        (self.root / f"{parent_name}-选中.zip").write_text("old")
        with mock.patch("routes_browse.zipx_command") as cmd:
            with self.assertRaises(ApiError) as ctx:
                _browse_compress_selection(
                    self.handler, {"ws": "i1", "paths": ["a.txt", "d"]}
                )
        self.assertEqual(ctx.exception.status, 409)
        cmd.assert_not_called()

    def test_delete_selection_prunes_nested_and_keeps_going(self):
        calls = []

        def fake_delete(root, vcs, rel):
            calls.append(rel)
            if rel == "bad":
                raise ApiError(400, "boom")
            return {"path": rel, "removed": True}

        with mock.patch("routes_browse.delete_entry", side_effect=fake_delete):
            out = _browse_delete_selection(
                self.handler,
                {"ws": "i1", "paths": ["d", "d/inside.txt", "a.txt", "bad"]},
            )
        self.assertEqual(calls, ["d", "a.txt", "bad"])
        self.assertEqual(out["deleted"], ["d", "a.txt"])
        self.assertEqual(out["failed"], [{"path": "bad", "message": "boom"}])
        self.assertFalse(out["ok"])

    def test_download_selection_single_file_streams_directly(self):
        sent = {}
        self.handler._send_download = lambda path, name, head=False: sent.update(path=path, name=name)
        query = {"ws": ["i1"], "path": ["a.txt"]}
        self.assertIs(_browse_download_selection(self.handler, query), STREAMED)
        self.assertEqual(sent["name"], "a.txt")
        self.assertEqual(sent["path"], str(self.root / "a.txt"))

    def test_download_selection_packs_mixed_entries(self):
        fake, _ = self.make_zipx()
        sent = {}

        def capture(path, name, head=False):
            sent.update(path=path, name=name, exists=Path(path).exists())

        self.handler._send_download = capture
        query = {"ws": ["i1"], "path": ["a.txt", "d"]}
        with mock.patch("routes_browse.zipx_command", return_value=fake):
            self.assertIs(_browse_download_selection(self.handler, query), STREAMED)
        self.assertTrue(sent["name"].endswith("-选中.zip"))
        self.assertTrue(sent["exists"])
        self.assertFalse(Path(sent["path"]).exists())

    def test_download_selection_cross_parents_keeps_relative_paths(self):
        fake, recorder = self.make_zipx()
        sent = {}
        self.handler._send_download = lambda path, name, head=False: sent.update(path=path, name=name)
        query = {"ws": ["i1"], "path": ["a.txt", "d/inside.txt"]}
        with mock.patch("routes_browse.zipx_command", return_value=fake):
            self.assertIs(_browse_download_selection(self.handler, query), STREAMED)
        self.assertEqual(sent["name"], self.root.name + "-选中.zip")
        self.assertEqual((recorder / "cwd").read_text().strip(), str(self.root))
        argv = (recorder / "argv").read_text().splitlines()
        self.assertEqual(argv[:3], ["pack", "a.txt", "d/inside.txt"])
        self.assertEqual(argv[3], "-o")

    def test_download_selection_prunes_nested_entries(self):
        fake, recorder = self.make_zipx()
        sent = {}
        self.handler._send_download = lambda path, name, head=False: sent.update(name=name)
        query = {"ws": ["i1"], "path": ["d", "d/inside.txt"]}
        with mock.patch("routes_browse.zipx_command", return_value=fake):
            self.assertIs(_browse_download_selection(self.handler, query), STREAMED)
        self.assertEqual(sent["name"], "d.zip")
        argv = (recorder / "argv").read_text().splitlines()
        self.assertEqual(argv[:2], ["pack", "d"])

    def test_download_selection_single_file_streams_directly(self):
        sent = {}
        self.handler._send_download = lambda path, name, head=False: sent.update(path=path, name=name)
        query = {"ws": ["i1"], "path": ["a.txt"]}
        self.assertIs(_browse_download_selection(self.handler, query), STREAMED)
        self.assertEqual(sent["name"], "a.txt")
        self.assertEqual(sent["path"], str(self.root / "a.txt"))

    def test_download_selection_packs_mixed_entries(self):
        fake, _ = self.make_zipx()
        sent = {}

        def capture(path, name, head=False):
            sent.update(path=path, name=name, exists=Path(path).exists())

        self.handler._send_download = capture
        query = {"ws": ["i1"], "path": ["a.txt", "d"]}
        with mock.patch("routes_browse.zipx_command", return_value=fake):
            self.assertIs(_browse_download_selection(self.handler, query), STREAMED)
        self.assertTrue(sent["name"].endswith("-选中.zip"))
        self.assertTrue(sent["exists"])
        self.assertFalse(Path(sent["path"]).exists())

    def test_download_selection_cross_parents_keeps_relative_paths(self):
        fake, recorder = self.make_zipx()
        sent = {}
        self.handler._send_download = lambda path, name, head=False: sent.update(path=path, name=name)
        query = {"ws": ["i1"], "path": ["a.txt", "d/inside.txt"]}
        with mock.patch("routes_browse.zipx_command", return_value=fake):
            self.assertIs(_browse_download_selection(self.handler, query), STREAMED)
        self.assertEqual(sent["name"], self.root.name + "-选中.zip")
        self.assertEqual((recorder / "cwd").read_text().strip(), str(self.root))
        argv = (recorder / "argv").read_text().splitlines()
        self.assertEqual(argv[:3], ["pack", "a.txt", "d/inside.txt"])
        self.assertEqual(argv[3], "-o")

    def test_download_selection_prunes_nested_entries(self):
        fake, recorder = self.make_zipx()
        sent = {}
        self.handler._send_download = lambda path, name, head=False: sent.update(name=name)
        query = {"ws": ["i1"], "path": ["d", "d/inside.txt"]}
        with mock.patch("routes_browse.zipx_command", return_value=fake):
            self.assertIs(_browse_download_selection(self.handler, query), STREAMED)
        self.assertEqual(sent["name"], "d.zip")
        argv = (recorder / "argv").read_text().splitlines()
        self.assertEqual(argv[:2], ["pack", "d"])

    def test_download_selection_single_file_streams_directly(self):
        sent = {}
        self.handler._send_download = lambda path, name, head=False: sent.update(path=path, name=name)
        query = {"ws": ["i1"], "path": ["a.txt"]}
        self.assertIs(_browse_download_selection(self.handler, query), STREAMED)
        self.assertEqual(sent["name"], "a.txt")
        self.assertEqual(sent["path"], str(self.root / "a.txt"))

    def test_download_selection_packs_mixed_entries(self):
        fake, _ = self.make_zipx()
        sent = {}

        def capture(path, name, head=False):
            sent.update(path=path, name=name, exists=Path(path).exists())

        self.handler._send_download = capture
        query = {"ws": ["i1"], "path": ["a.txt", "d"]}
        with mock.patch("routes_browse.zipx_command", return_value=fake):
            self.assertIs(_browse_download_selection(self.handler, query), STREAMED)
        self.assertTrue(sent["name"].endswith("-选中.zip"))
        self.assertTrue(sent["exists"])
        self.assertFalse(Path(sent["path"]).exists())

    def test_download_selection_cross_parents_keeps_relative_paths(self):
        fake, recorder = self.make_zipx()
        sent = {}
        self.handler._send_download = lambda path, name, head=False: sent.update(path=path, name=name)
        query = {"ws": ["i1"], "path": ["a.txt", "d/inside.txt"]}
        with mock.patch("routes_browse.zipx_command", return_value=fake):
            self.assertIs(_browse_download_selection(self.handler, query), STREAMED)
        self.assertEqual(sent["name"], self.root.name + "-选中.zip")
        self.assertEqual((recorder / "cwd").read_text().strip(), str(self.root))
        argv = (recorder / "argv").read_text().splitlines()
        self.assertEqual(argv[:3], ["pack", "a.txt", "d/inside.txt"])
        self.assertEqual(argv[3], "-o")

    def test_download_selection_prunes_nested_entries(self):
        fake, recorder = self.make_zipx()
        sent = {}
        self.handler._send_download = lambda path, name, head=False: sent.update(name=name)
        query = {"ws": ["i1"], "path": ["d", "d/inside.txt"]}
        with mock.patch("routes_browse.zipx_command", return_value=fake):
            self.assertIs(_browse_download_selection(self.handler, query), STREAMED)
        self.assertEqual(sent["name"], "d.zip")
        argv = (recorder / "argv").read_text().splitlines()
        self.assertEqual(argv[:2], ["pack", "d"])

    def test_download_selection_single_file_streams_directly(self):
        sent = {}
        self.handler._send_download = lambda path, name, head=False: sent.update(path=path, name=name)
        query = {"ws": ["i1"], "path": ["a.txt"]}
        self.assertIs(_browse_download_selection(self.handler, query), STREAMED)
        self.assertEqual(sent["name"], "a.txt")
        self.assertEqual(sent["path"], str(self.root / "a.txt"))

    def test_download_selection_packs_mixed_entries(self):
        fake, _ = self.make_zipx()
        sent = {}

        def capture(path, name, head=False):
            sent.update(path=path, name=name, exists=Path(path).exists())

        self.handler._send_download = capture
        query = {"ws": ["i1"], "path": ["a.txt", "d"]}
        with mock.patch("routes_browse.zipx_command", return_value=fake):
            self.assertIs(_browse_download_selection(self.handler, query), STREAMED)
        self.assertTrue(sent["name"].endswith("-选中.zip"))
        self.assertTrue(sent["exists"])
        self.assertFalse(Path(sent["path"]).exists())

    def test_download_selection_cross_parents_keeps_relative_paths(self):
        fake, recorder = self.make_zipx()
        sent = {}
        self.handler._send_download = lambda path, name, head=False: sent.update(path=path, name=name)
        query = {"ws": ["i1"], "path": ["a.txt", "d/inside.txt"]}
        with mock.patch("routes_browse.zipx_command", return_value=fake):
            self.assertIs(_browse_download_selection(self.handler, query), STREAMED)
        self.assertEqual(sent["name"], self.root.name + "-选中.zip")
        self.assertEqual((recorder / "cwd").read_text().strip(), str(self.root))
        argv = (recorder / "argv").read_text().splitlines()
        self.assertEqual(argv[:3], ["pack", "a.txt", "d/inside.txt"])
        self.assertEqual(argv[3], "-o")

    def test_download_selection_prunes_nested_entries(self):
        fake, recorder = self.make_zipx()
        sent = {}
        self.handler._send_download = lambda path, name, head=False: sent.update(name=name)
        query = {"ws": ["i1"], "path": ["d", "d/inside.txt"]}
        with mock.patch("routes_browse.zipx_command", return_value=fake):
            self.assertIs(_browse_download_selection(self.handler, query), STREAMED)
        self.assertEqual(sent["name"], "d.zip")
        argv = (recorder / "argv").read_text().splitlines()
        self.assertEqual(argv[:2], ["pack", "d"])



if __name__ == "__main__":
    unittest.main(verbosity=2)
