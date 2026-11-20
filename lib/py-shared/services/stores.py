# @Author: Himmeltala
# @Date: 2026-11-13 23:20:04
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-17 23:35:13
# @FilePath: \lib\py-shared\services\stores.py
# @Description: 状态行与别名存储：bash 写状态文件，这里只读行、另存别名与左侧分组。

import os
import threading
from pathlib import Path

from fileio import read_json, write_json
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


# 左侧分组结构的规模上限：节点条数与分组名的长度。
LAYOUT_MAX_NODES = 2000
LAYOUT_MAX_NAME = 80
LAYOUT_ID_MAX = 64


def clean_node(item):
    """一条节点：分组要有名字，工作区只认 id；不合格的丢掉。"""
    if not isinstance(item, dict):
        return None
    kind = item.get("kind")
    if kind not in ("group", "ws"):
        return None
    ident = str(item.get("id") or "").strip()
    if not ident or len(ident) > LAYOUT_ID_MAX:
        return None
    parent = str(item.get("parent") or "").strip()
    if len(parent) > LAYOUT_ID_MAX or parent == ident:
        parent = ""
    node = {"kind": kind, "id": ident, "parent": parent}
    if kind == "group":
        name = " ".join(str(item.get("name") or "").split())[:LAYOUT_MAX_NAME]
        if not name:
            return None
        node["name"] = name
    return node


class LayoutStore:
    """左侧工作区的分组结构，存在状态文件旁边；整份读写，同一父级下的先后按数组位置。"""

    def __init__(self, path):
        self.path = Path(path)
        self._lock = threading.Lock()

    def nodes(self):
        data = read_json(self.path, default=None)
        items = data.get("nodes") if isinstance(data, dict) else None
        if not isinstance(items, list):
            return []
        out = []
        for item in items:
            node = clean_node(item)
            if node is not None:
                out.append(node)
            if len(out) >= LAYOUT_MAX_NODES:
                break
        return out

    def set(self, items):
        if not isinstance(items, list):
            raise ApiError(400, "分组结构不对")
        if len(items) > LAYOUT_MAX_NODES:
            raise ApiError(400, "节点太多，最多 %s 个" % LAYOUT_MAX_NODES)
        out = []
        for item in items:
            node = clean_node(item)
            if node is not None:
                out.append(node)
        with self._lock:
            write_json(self.path, {"nodes": out}, ensure_ascii=False)
        return out

    def drop(self, kind, ident):
        """去掉某个节点；工作区移出时，指向它的那条分组记录也一并清掉。"""
        nodes = self.nodes()
        kept = [node for node in nodes if not (node["kind"] == kind and node["id"] == ident)]
        if len(kept) == len(nodes):
            return nodes
        return self.set(kept)


def attach_layout(snapshot, store):
    """把左侧分组结构拼进状态回话。"""
    if store is not None:
        snapshot["groups"] = store.nodes()
    return snapshot
