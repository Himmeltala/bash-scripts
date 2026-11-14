"""状态行与别名存储：bash 写状态文件，这里只读行、另存别名。"""

import os

from kvstore import FS, LineStore
from web import ApiError, log


class Row:
    """状态行按列名取值。列数不对的行由调用方的 State 丢掉，这里只管取。"""

    __slots__ = ("kind", "f")

    def __init__(self, parts):
        self.kind = parts[0]
        self.f = parts

    def __getitem__(self, idx):
        if isinstance(idx, slice):
            return self.f[idx]
        return self.f[idx] if idx < len(self.f) else ""


def attach_alias_rel(snapshot, store):
    """把别名与相对家目录的路径拼进工作区列表。"""
    aliases = store.all() if store is not None else {}
    home = os.path.expanduser("~")
    for ws in snapshot.get("workspaces", []):
        ws["alias"] = aliases.get(ws["id"], "")
        root = ws.get("root", "")
        try:
            ws["rel"] = os.path.relpath(root, home)
        except (TypeError, ValueError):
            ws["rel"] = root
    return snapshot


class HomeStore(LineStore):
    """工作区到某个工具链目录的映射，存在状态文件旁边；空值表示删掉这一行。"""

    def __init__(self, path, label="工具链"):
        self.label = label
        LineStore.__init__(self, path, allow_empty=True, on_error=self._write_failed)

    def _write_failed(self, exc):
        log("写 %s 设置失败 %s：%s" % (self.label, self.path, exc))

    def get(self, ws):
        return LineStore.get(self, ws, "")

    def set(self, ws, value):
        if value:
            LineStore.set(self, ws, value)
        else:
            LineStore.remove(self, ws)


def attach_home(snapshot, store, field, is_home):
    """把每个工作区选中的目录与失效标记拼进状态回话。"""
    for ws in snapshot.get("workspaces", []):
        value = store.get(ws["id"])
        ws[field] = value
        ws[field + "_missing"] = bool(value) and not is_home(value)
    return snapshot


class AliasStore(LineStore):
    """工作区别名，存在状态文件旁边；状态文件本身仍由 bash 写，这里不碰它。"""

    def __init__(self, path):
        LineStore.__init__(self, path, allow_empty=False, on_error=self._write_failed)

    def _write_failed(self, exc):
        log("写别名失败 %s：%s" % (self.path, exc))

    def normalize(self, value):
        return " ".join((value or "").split()).replace(FS, " ")

    def validate(self, key, value):
        if len(value) > 80:
            raise ApiError(400, "别名太长，最多 80 个字")
