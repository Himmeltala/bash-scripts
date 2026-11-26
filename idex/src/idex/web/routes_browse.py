# @Author: Himmeltala
# @Date: 2026-11-26 09:29:54
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-26 09:29:54
# @FilePath: \idex\src\idex\web\routes_browse.py
# @Description: 浏览目录的网页接口：目录树、取文件、下载、搜索与增删改。

"""浏览目录的网页接口：目录树、取文件、下载、搜索与增删改。"""

import os
import posixpath
import shutil
import subprocess
import tempfile
import threading
from pathlib import Path

from web import ApiError, STREAMED

from browse_fs import (
    browse_file_info,
    browse_files,
    browse_list,
    browse_rel,
    browse_search,
    delete_entry,
    entry_stat,
    make_entry,
    rename_entry,
    save_file,
)
from server_common import inside
from stores import LayoutStore  # noqa: F401  只为了让类型提示与依赖关系看得出来

SEARCH_IGNORE_DEFAULTS = (".git", ".svn", ".hg", "node_modules", "__pycache__", "dist", "build", "target")
# 每个工作区最近一次搜索的代次；新请求换了代，旧的那个扫到一半就停。
SEARCH_TOKENS = {}
# 大目录打包可能很久，给个上限；超时当失败回给页面。
COMPRESS_TIMEOUT = 600


def zipx_command():
    """打包命令：PATH 里的 zipx，找不到再看同级检出的 zipx/bin/zipx；两者都要能执行。"""
    found = shutil.which("zipx")
    if found and os.access(found, os.X_OK):
        return found
    bundled = Path(__file__).resolve().parents[4] / "zipx" / "bin" / "zipx"
    if bundled.is_file() and os.access(str(bundled), os.X_OK):
        return str(bundled)
    return None


def _discard_archive(path):
    """失败时清掉这次调用可能留下的半截包；清不掉也不能盖住原本的错误。"""
    try:
        if os.path.lexists(path):
            os.unlink(path)
    except OSError:
        pass


def _zipx_pack(target, archive):
    """用 zipx 把目录打成 zip（archive 是绝对路径）。压缩与目录下载共用这一条。"""
    zipx = zipx_command()
    if not zipx:
        raise ApiError(503, "找不到可执行的 zipx 命令，装好 zipx 或用同级检出的再试")
    # 在父目录里按条目名打包，包内路径才是相对目录名；选项放在条目后面 zipx 也认。
    parent = os.path.dirname(target)
    try:
        proc = subprocess.run(
            [zipx, "pack", os.path.basename(target), "-o", archive],
            cwd=parent,
            capture_output=True,
            text=True,
            timeout=COMPRESS_TIMEOUT,
        )
    except subprocess.TimeoutExpired:
        _discard_archive(archive)
        raise ApiError(504, "压缩超时：%s" % os.path.basename(target))
    except OSError as exc:
        _discard_archive(archive)
        raise ApiError(503, "起 zipx 失败：%s" % exc)
    if proc.returncode != 0:
        _discard_archive(archive)
        message = (proc.stderr or proc.stdout or "").strip()
        raise ApiError(400, message or "zipx 打包失败")
    if not os.path.isfile(archive):
        _discard_archive(archive)
        raise ApiError(400, "zipx 没有生成包文件")
    return archive


# 同一个包文件同时只让一个请求读写：两个请求压同一目录时，失败的清理不能删掉
# 另一个刚打好的包。Handler 每个请求一个新实例，所以锁放模块上。
_COMPRESS_LOCKS = {}
_COMPRESS_LOCKS_GUARD = threading.Lock()


def _compress_lock(path):
    key = os.path.realpath(path)
    with _COMPRESS_LOCKS_GUARD:
        lock = _COMPRESS_LOCKS.get(key)
        if lock is None:
            lock = _COMPRESS_LOCKS[key] = threading.Lock()
        return lock


def _browse_compress(handler, body):
    """把工作区里的一个目录压成同级同名 zip；已存在的包不覆盖。"""
    handler._check_write()
    ws = handler.store.find(str(body.get("ws", "")))
    if ws is None:
        raise ApiError(404, "没有这个工作区")
    # 与浏览接口同一套根：登记目录本身；尾斜杠去掉，"." 与根目录一样不能压。
    root = ws["root"]
    rel = posixpath.normpath(browse_rel(str(body.get("path", ""))).rstrip("/"))
    if not rel or rel == ".":
        raise ApiError(400, "工作区根目录不能压缩：包会落到工作区外")
    target = os.path.join(root, rel)
    if not inside(root, target):
        raise ApiError(400, "路径要在工作副本里：%s" % rel)
    if os.path.realpath(target) == os.path.realpath(root):
        raise ApiError(400, "工作区根目录不能压缩：包会落到工作区外")
    if not os.path.isdir(target):
        raise ApiError(400, "只能压缩目录：%s" % rel)
    parent = os.path.dirname(target)
    archive = os.path.join(parent, os.path.basename(target) + ".zip")

    def pack():
        # 断链的符号链接也算已存在；否则 zipx 会顺着它写到别处。
        if os.path.lexists(archive):
            raise ApiError(409, "「%s」已存在" % os.path.basename(archive))
        _zipx_pack(target, archive)
        if not inside(root, archive):
            _discard_archive(archive)
            raise ApiError(400, "包文件落在工作副本外：%s" % os.path.basename(archive))
        return {
            "ok": True,
            "path": os.path.relpath(archive, root).replace(os.sep, "/"),
            "size": os.path.getsize(archive),
        }

    # 存在判断、打包与失败清理放在同一把锁里，并发压同一目录时后到的请求会等前一个收尾。
    with _compress_lock(archive):
        return pack()


class BrowseRoutes:
    """路由表里浏览目录那几条的实现，靠 MRO 混进 Handler。"""

    def _stat(self, query):
        ws = self._ws(query)
        rel = (query.get("path") or [""])[0]
        return {"workspace": ws, **entry_stat(ws["root"], rel)}

    def _tree(self, query):
        ws = self._ws(query)
        rel = (query.get("path") or [""])[0]
        return {"workspace": ws, **browse_list(ws["root"], rel)}

    def _file(self, query):
        ws = self._ws(query)
        rel = (query.get("path") or [""])[0]
        return {"workspace": ws, "path": rel, **browse_file_info(ws["root"], rel)}

    def _download(self, query, head=False):
        ws = self._ws(query)
        rel = browse_rel((query.get("path") or [""])[0])
        root = ws["root"]
        target = os.path.join(root, rel) if rel else root
        if not inside(root, target):
            raise ApiError(400, "路径要在工作副本里：%s" % rel)
        if os.path.isdir(target):
            # 目录下载和「压缩」走同一个 zipx，别一边 Python 一边 zipx。
            handle = tempfile.NamedTemporaryFile(prefix="idex-", suffix=".zip", delete=False)
            path = handle.name
            handle.close()
            os.unlink(path)
            name = (os.path.basename(target.rstrip("/")) or "download") + ".zip"
            try:
                _zipx_pack(target, path)
                self._send_download(path, name, head=head)
            finally:
                _discard_archive(path)
            return STREAMED
        if not os.path.isfile(target):
            raise ApiError(404, "没有这个文件：%s" % (rel or "根目录"))
        self._send_download(target, os.path.basename(target), head=head)
        return STREAMED

    def _save(self, body):
        self._check_write()
        ws = self.store.find(str(body.get("ws", "")))
        if ws is None:
            raise ApiError(404, "没有这个工作区")
        rel = str(body.get("path", ""))
        text = body.get("text", "")
        if not isinstance(text, str):
            raise ApiError(400, "文件内容要是文本")
        return {"workspace": ws, **save_file(ws["root"], rel, text)}

    def _browse_write_ws(self, body):
        self._check_write()
        ws = self.store.find(str(body.get("ws", "")))
        if ws is None:
            raise ApiError(404, "没有这个工作区")
        return ws

    def _browse_create(self, body, kind):
        ws = self._browse_write_ws(body)
        rel = str(body.get("dir", ""))
        name = str(body.get("name", ""))
        return {"workspace": ws, **make_entry(ws["root"], rel, name, kind)}

    def _browse_rename(self, body):
        ws = self._browse_write_ws(body)
        rel = str(body.get("path", ""))
        name = str(body.get("name", ""))
        return {"workspace": ws, **rename_entry(ws["root"], ws.get("vcs", "none"), rel, name)}

    def _browse_delete(self, body):
        ws = self._browse_write_ws(body)
        rel = str(body.get("path", ""))
        return {"workspace": ws, **delete_entry(ws["root"], ws.get("vcs", "none"), rel)}

    def _browse_compress(self, body):
        return _browse_compress(self, body)

    def _search(self, query):
        ws = self._ws(query)
        rel = (query.get("path") or [""])[0]
        text = (query.get("q") or [""])[0]
        mode = (query.get("mode") or ["name"])[0]
        ignore = (
            self.settings.search_ignore()
            if self.settings is not None
            else list(SEARCH_IGNORE_DEFAULTS)
        )
        token = (query.get("token") or [""])[0]
        should_stop = None
        if token:
            SEARCH_TOKENS[ws["id"]] = token
            should_stop = lambda: SEARCH_TOKENS.get(ws["id"]) != token
        return {
            "workspace": ws,
            **browse_search(ws["root"], rel, text, mode, ignore, should_stop),
        }

    def _files(self, query):
        ws = self._ws(query)
        ignore = (
            self.settings.search_ignore()
            if self.settings is not None
            else list(SEARCH_IGNORE_DEFAULTS)
        )
        files, truncated = browse_files(ws["root"], ignore, ws.get("vcs", "none"))
        return {"files": files, "truncated": truncated}
