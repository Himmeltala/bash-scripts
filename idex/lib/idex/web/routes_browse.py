"""浏览目录的网页接口：目录树、取文件、下载、搜索与增删改。"""

import os

from web import ApiError, STREAMED, zip_dir

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
            path, _ = zip_dir(target)
            name = (os.path.basename(target.rstrip("/")) or "download") + ".zip"
            try:
                self._send_download(path, name, head=head)
            finally:
                os.unlink(path)
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
