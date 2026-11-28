# @Author: Himmeltala
# @Date: 2026-11-28 20:10:00
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-28 20:10:00
# @FilePath: \idex\src\idex\web\office_preview.py
# @Description: Office 三件套预览：用 LibreOffice 无头转 PDF，按文件指纹缓存。

"""Office 预览：doc/docx/xls/xlsx/xlsm/ppt/pptx 交给 LibreOffice 转 PDF，再按文件指纹缓存；pdf 原样下发。

只做只读转换，不保留动画；字体缺失会改变排版。缓存放在 state 目录的 previews 下，
命中直接发文件，源文件变动后指纹变化自动重转。
"""

import hashlib
import os
import shutil
import subprocess
import tempfile
import threading
import time
from pathlib import Path

from web import ApiError
from server_common import inside

# 旧版 doc/xls/ppt 也交给 LibreOffice；pdf 本来就是目标格式，直接下发。
OFFICE_EXTS = {"doc", "docx", "xls", "xlsx", "xlsm", "ppt", "pptx", "pdf"}
OFFICE_MAX = 50 * 1024 * 1024
CONVERT_TIMEOUT = 120
CACHE_TTL = 7 * 24 * 3600
CACHE_MAX_BYTES = 1024 ** 3
# 同时只让少量 LibreOffice 进程跑，避免一次预览把整机 CPU 吃满。
_CONVERT_SLOTS = threading.Semaphore(2)

_LOCKS = {}
_LOCKS_GUARD = threading.Lock()
_PRUNE_GUARD = threading.Lock()
_last_prune = 0.0


def soffice_command():
    """找 LibreOffice 可执行文件；IDEX_SOFFICE 可指定路径。"""
    candidates = [os.environ.get("IDEX_SOFFICE") or "", "soffice", "libreoffice"]
    for name in candidates:
        if not name:
            continue
        found = name if os.path.sep in name else shutil.which(name)
        if found and os.path.isfile(found) and os.access(found, os.X_OK):
            return found
    return None


def _lock_for(path):
    key = str(path)
    with _LOCKS_GUARD:
        lock = _LOCKS.get(key)
        if lock is None:
            lock = _LOCKS[key] = threading.Lock()
        return lock


def _fingerprint(target):
    stat = os.stat(target)
    text = "\0".join([os.path.realpath(target), str(stat.st_size), str(stat.st_mtime_ns)])
    return hashlib.sha1(text.encode("utf-8")).hexdigest()


def _run_conversion(soffice, target, output):
    profile = tempfile.mkdtemp(prefix="idex-lo-")
    staging = tempfile.mkdtemp(prefix="idex-pdf-")
    try:
        command = [
            soffice,
            "--headless",
            "--norestore",
            "--nolockcheck",
            "--nodefault",
            "--nofirststartwizard",
            "-env:UserInstallation=file://%s" % profile,
            "--convert-to",
            "pdf",
            "--outdir",
            staging,
            str(target),
        ]
        with _CONVERT_SLOTS:
            proc = subprocess.Popen(
                command,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                start_new_session=True,
            )
            try:
                stdout, stderr = proc.communicate(timeout=CONVERT_TIMEOUT)
            except subprocess.TimeoutExpired:
                _kill_group(proc)
                raise ApiError(504, "Office 转换超时：%s" % os.path.basename(target))
        if proc.returncode != 0:
            message = (stderr or stdout or "").strip()
            raise ApiError(422, (message or "LibreOffice 转换失败")[:500])
        produced = sorted(Path(staging).glob("*.pdf"))
        if not produced:
            raise ApiError(422, "LibreOffice 没有生成 PDF：%s" % os.path.basename(target))
        # 先写临时名再改名，避免并发读到半截 PDF。
        temp_out = output.with_suffix(".tmp")
        shutil.copyfile(produced[0], temp_out)
        os.replace(temp_out, output)
    finally:
        shutil.rmtree(profile, ignore_errors=True)
        shutil.rmtree(staging, ignore_errors=True)


def _kill_group(proc):
    try:
        os.killpg(proc.pid, 15)
    except OSError:
        pass
    try:
        proc.wait(timeout=5)
        return
    except subprocess.TimeoutExpired:
        pass
    try:
        os.killpg(proc.pid, 9)
    except OSError:
        pass
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        pass


def _prune(cache_dir):
    """删掉过期的缓存；总量超限时从最旧的删起。每小时最多检查一次。"""
    global _last_prune
    now = time.time()
    with _PRUNE_GUARD:
        if now - _last_prune < 3600:
            return
        _last_prune = now
        entries = []
        total = 0
        for item in Path(cache_dir).glob("*.pdf"):
            try:
                stat = item.stat()
            except OSError:
                continue
            if now - stat.st_mtime > CACHE_TTL:
                try:
                    item.unlink()
                except OSError:
                    pass
                continue
            entries.append((stat.st_mtime, stat.st_size, item))
            total += stat.st_size
        for _, size, item in sorted(entries):
            if total <= CACHE_MAX_BYTES:
                break
            try:
                item.unlink()
                total -= size
            except OSError:
                pass


def preview_pdf(root, rel, cache_dir):
    """把工作区里的 Office 文件转成 PDF 并返回缓存路径；失败抛 ApiError。"""
    rel = str(rel or "").strip().lstrip("/")
    if not rel:
        raise ApiError(400, "要给一个文件")
    target = os.path.join(root, rel)
    if not inside(root, target):
        raise ApiError(400, "路径要在工作副本里：%s" % rel)
    if not os.path.isfile(target):
        raise ApiError(404, "没有这个文件：%s" % rel)
    ext = os.path.splitext(target)[1].lower().lstrip(".")
    if ext not in OFFICE_EXTS:
        raise ApiError(400, "只支持 doc/docx/xls/xlsx/xlsm/ppt/pptx/pdf：%s" % rel)
    if os.path.getsize(target) > OFFICE_MAX:
        raise ApiError(413, "文件超过 %d MB，请下载后查看" % (OFFICE_MAX // (1024 * 1024)))
    # PDF 已是浏览器要的格式，不需要转换与缓存。
    if ext == "pdf":
        return Path(target)
    soffice = soffice_command()
    if not soffice:
        raise ApiError(503, "找不到 LibreOffice，装好 libreoffice 后再试")

    cache_dir = Path(cache_dir)
    cache_dir.mkdir(parents=True, exist_ok=True)
    output = cache_dir / ("%s.pdf" % _fingerprint(target))
    with _lock_for(output):
        if not output.is_file():
            _run_conversion(soffice, target, output)
        else:
            # 命中时更新 mtime，清理按最近使用时间淘汰。
            try:
                os.utime(output)
            except OSError:
                pass
    _prune(cache_dir)
    return output
