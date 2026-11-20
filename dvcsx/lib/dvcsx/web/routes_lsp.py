"""代码索引的网页接口：定义、引用、符号、悬停、诊断与重命名。"""

import os

from web import ApiError
from lsp_client import LspError, LspUnavailable, apply_workspace_edit
from server_common import MAX_FILE, inside, safe_rel, workspace_lock


class LspRoutes:
    """路由表里 lsp/* 那几条的实现，靠 MRO 混进 Handler。"""

    def _lsp_status(self):
        # 不拉进程，只报各语言服务器装没装；同样只认本机，免得把本机有什么暴露出去。
        self._check_write()
        if self.lsp is None:
            raise ApiError(404, "代码索引没有起来")
        return {"servers": self.lsp.status()}

    def _lsp_definition(self, body):
        return self._lsp_query(body, "definition")

    def _lsp_file_args(self, body):
        self._check_write()
        if self.lsp is None:
            raise ApiError(404, "代码索引没有起来")
        ws = self.store.find(str(body.get("ws", "")))
        if ws is None:
            raise ApiError(404, "没有这个工作区：%s" % body.get("ws", ""))
        rel = safe_rel(str(body.get("path", "")))
        full = os.path.join(ws["root"], rel)
        if not inside(ws["root"], full) or not os.path.isfile(full):
            raise ApiError(400, "文件不存在：%s" % rel)
        text = body.get("text")
        if not isinstance(text, str):
            raise ApiError(400, "要把文件内容一起带上")
        if len(text.encode("utf-8")) > MAX_FILE:
            raise ApiError(400, "文件太大，超过 %d KB 不做索引" % (MAX_FILE // 1024))
        return ws, rel, text

    def _lsp_args(self, body):
        ws, rel, text = self._lsp_file_args(body)
        try:
            line = int(body.get("line"))
            character = int(body.get("character"))
        except (TypeError, ValueError):
            raise ApiError(400, "行与列要是整数")
        if line < 0 or character < 0:
            raise ApiError(400, "行与列不能是负数")
        return ws, rel, text, line, character

    def _lsp_query(self, body, action="definition"):
        ws, rel, text, line, character = self._lsp_args(body)
        try:
            return self.lsp.query(ws["id"], ws["root"], rel, text, line, character, action)
        except LspUnavailable as exc:
            raise ApiError(400, str(exc))
        except LspError as exc:
            raise ApiError(504, str(exc))

    def _lsp_symbols(self, body):
        ws, rel, text = self._lsp_file_args(body)
        try:
            return self.lsp.symbols(ws["id"], ws["root"], rel, text)
        except LspUnavailable as exc:
            raise ApiError(400, str(exc))
        except LspError as exc:
            raise ApiError(504, str(exc))

    def _lsp_hover(self, body):
        ws, rel, text, line, character = self._lsp_args(body)
        try:
            return self.lsp.hover(ws["id"], ws["root"], rel, text, line, character)
        except LspUnavailable as exc:
            raise ApiError(400, str(exc))
        except LspError as exc:
            raise ApiError(504, str(exc))

    def _lsp_diagnostics(self, body):
        ws, rel, text = self._lsp_file_args(body)
        try:
            return self.lsp.diagnostics(ws["id"], ws["root"], rel, text)
        except LspUnavailable as exc:
            raise ApiError(400, str(exc))
        except LspError as exc:
            raise ApiError(504, str(exc))

    def _lsp_rename(self, body, apply=False):
        ws, rel, text, line, character = self._lsp_args(body)
        name = body.get("newName")
        if not isinstance(name, str):
            raise ApiError(400, "要给新名字")
        try:
            data = self.lsp.rename_plan(
                ws["id"], ws["root"], rel, text, line, character, name
            )
        except LspUnavailable as exc:
            raise ApiError(400, str(exc))
        except LspError as exc:
            raise ApiError(504, str(exc))
        plan = data["plan"]
        summary = {
            "server": data["server"],
            "files": [{"path": item["path"], "edits": len(item["edits"])} for item in plan],
            "total": sum(len(item["edits"]) for item in plan),
        }
        if not apply:
            return summary
        lock = workspace_lock(ws["id"])
        if not lock.acquire(blocking=False):
            raise ApiError(409, "这个工作副本上还有别的操作在跑，等它结束再重命名")
        try:
            applied = apply_workspace_edit(ws["root"], plan)
        except LspError as exc:
            raise ApiError(400, str(exc))
        finally:
            lock.release()
        return {
            "server": data["server"],
            "files": applied,
            "total": sum(item["edits"] for item in applied),
            "applied": True,
        }
