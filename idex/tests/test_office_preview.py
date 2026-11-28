#!/usr/bin/env python3
# @Author: Himmeltala
# @Date: 2026-11-28 20:30:00
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-28 20:30:00
# @FilePath: \idex\tests\test_office_preview.py
# @Description: Office 预览转换：缓存、指纹、错误映射与并发去重。

"""Office 预览转换：缓存、指纹、错误映射与并发去重。"""

import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

REPO = Path(__file__).resolve().parents[2]
WEB = REPO / "idex" / "src" / "idex" / "web"
sys.path[:0] = [
    str(REPO / "lib" / "py-shared" / "commons"),
    str(REPO / "lib" / "py-shared" / "services"),
    str(WEB),
]
from web import ApiError
import office_preview


class OfficePreviewTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name) / "repo"
        self.root.mkdir()
        self.cache = Path(self.tmp.name) / "cache"
        self.file = self.root / "报告.docx"
        self.file.write_bytes(b"docx")
        self.recorder = Path(self.tmp.name) / "calls"

    def fake_soffice(self, body=''):
        """假 soffice：按 --outdir 生成一个 PDF，并记下调用次数。"""
        script = Path(self.tmp.name) / "soffice"
        script.write_text(
            "#!/bin/sh\n"
            f"count=0; [ -f '{self.recorder}' ] && count=$(cat '{self.recorder}')\n"
            f"echo $((count + 1)) > '{self.recorder}'\n"
            "out=''\n"
            "while [ $# -gt 0 ]; do\n"
            "  case \"$1\" in --outdir) out=\"$2\"; shift 2;; *) shift;; esac\n"
            "done\n"
            f"{body}\n"
            "[ -n \"$out\" ] && printf 'pdf' > \"$out/preview.pdf\"\n",
            encoding="utf-8",
        )
        script.chmod(0o755)
        return str(script)

    def calls(self):
        return int(self.recorder.read_text()) if self.recorder.exists() else 0

    def test_legacy_formats_convert(self):
        fake = self.fake_soffice()
        for name in ("a.doc", "b.xls", "c.ppt"):
            (self.root / name).write_bytes(b"legacy")
        with mock.patch("office_preview.soffice_command", return_value=fake):
            for name in ("a.doc", "b.xls", "c.ppt"):
                out = office_preview.preview_pdf(str(self.root), name, self.cache)
                self.assertTrue(out.is_file(), name)
        self.assertEqual(self.calls(), 3)

    def test_pdf_is_served_without_conversion(self):
        target = self.root / "manual.pdf"
        target.write_bytes(b"%PDF-1.4 fake")
        with mock.patch("office_preview.soffice_command") as cmd:
            out = office_preview.preview_pdf(str(self.root), "manual.pdf", self.cache)
        self.assertEqual(out, target)
        cmd.assert_not_called()

    def test_converts_once_and_serves_from_cache(self):
        fake = self.fake_soffice()
        with mock.patch("office_preview.soffice_command", return_value=fake):
            first = office_preview.preview_pdf(str(self.root), "报告.docx", self.cache)
            self.assertTrue(first.is_file())
            self.assertEqual(self.calls(), 1)
            second = office_preview.preview_pdf(str(self.root), "报告.docx", self.cache)
        self.assertEqual(first, second)
        self.assertEqual(self.calls(), 1)

    def test_fingerprint_changes_after_edit(self):
        fake = self.fake_soffice()
        with mock.patch("office_preview.soffice_command", return_value=fake):
            first = office_preview.preview_pdf(str(self.root), "报告.docx", self.cache)
            self.file.write_bytes(b"docx changed")
            second = office_preview.preview_pdf(str(self.root), "报告.docx", self.cache)
        self.assertNotEqual(first, second)
        self.assertEqual(self.calls(), 2)

    def test_rejects_missing_and_unsupported(self):
        fake = self.fake_soffice()
        note = self.root / "a.txt"
        note.write_text("x")
        with mock.patch("office_preview.soffice_command", return_value=fake):
            with self.assertRaises(ApiError) as ctx:
                office_preview.preview_pdf(str(self.root), "a.txt", self.cache)
            self.assertEqual(ctx.exception.status, 400)
            with self.assertRaises(ApiError) as ctx:
                office_preview.preview_pdf(str(self.root), "missing.docx", self.cache)
            self.assertEqual(ctx.exception.status, 404)
            with self.assertRaises(ApiError) as ctx:
                office_preview.preview_pdf(str(self.root), "../outside.docx", self.cache)
            self.assertEqual(ctx.exception.status, 400)

    def test_oversize_is_413(self):
        fake = self.fake_soffice()
        with mock.patch("office_preview.soffice_command", return_value=fake), \
                mock.patch("office_preview.OFFICE_MAX", 1):
            with self.assertRaises(ApiError) as ctx:
                office_preview.preview_pdf(str(self.root), "报告.docx", self.cache)
        self.assertEqual(ctx.exception.status, 413)

    def test_missing_soffice_is_503(self):
        with mock.patch("office_preview.soffice_command", return_value=None):
            with self.assertRaises(ApiError) as ctx:
                office_preview.preview_pdf(str(self.root), "报告.docx", self.cache)
        self.assertEqual(ctx.exception.status, 503)

    def test_conversion_failure_is_422_and_leaves_no_cache(self):
        fake = self.fake_soffice('echo "boom" >&2; exit 1')
        with mock.patch("office_preview.soffice_command", return_value=fake):
            with self.assertRaises(ApiError) as ctx:
                office_preview.preview_pdf(str(self.root), "报告.docx", self.cache)
        self.assertEqual(ctx.exception.status, 422)
        self.assertIn("boom", ctx.exception.message)
        self.assertEqual(list(self.cache.glob("*.pdf")), [])

    def test_timeout_is_504(self):
        fake = self.fake_soffice("exec sleep 5")
        with mock.patch("office_preview.soffice_command", return_value=fake), \
                mock.patch("office_preview.CONVERT_TIMEOUT", 0.2):
            with self.assertRaises(ApiError) as ctx:
                office_preview.preview_pdf(str(self.root), "报告.docx", self.cache)
        self.assertEqual(ctx.exception.status, 504)


if __name__ == "__main__":
    unittest.main(verbosity=2)
