# @Author: Himmeltala
# @Date: 2026-11-26 09:29:54
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-26 09:29:54
# @FilePath: \idex\src\idex\web\server_stores.py
# @Description: 工作区登记与全局设置的存储：都落在 state.json 旁边。

"""工作区登记与全局设置的存储：都落在 state.json 旁边。"""

import hashlib
import os
import threading
import time
from pathlib import Path
from urllib.parse import unquote

from web import ApiError
from fileio import read_json, write_json
from vcs_summary import (
    detect_vcs,
)

# 搜索默认跳过的目录：依赖、缓存与构建产物，列出来也翻不动。
SEARCH_IGNORE_DEFAULTS = [".git", ".svn", ".hg", "node_modules", "__pycache__", "dist", "build", "target"]
SEARCH_IGNORE_MAX = 50
SEARCH_IGNORE_LEN = 80
# 编辑器配色与代码地图。
EDITOR_THEMES = ("auto", "github-light", "github-dark", "one-dark", "dracula")
# 默认设置模板：重置与「未设置」时的回退都读这一份，别的模块不再各写一份。
SHORTCUT_DEFAULTS = {
    "save": "Ctrl+S",
    "commit": "Ctrl+Enter",
    "browseSearch": "Ctrl+Shift+E",
    "browseContentSearch": "Ctrl+Shift+F",
    "quickOpen": "Ctrl+P",
    "gotoLine": "Ctrl+G",
    "outline": "Ctrl+Shift+O",
    "problems": "Ctrl+Shift+M",
    "hover": "Ctrl+I",
    "editorFind": "Ctrl+F",
    "complete": "Ctrl+Space",
    "format": "Shift+Alt+F",
    "rename": "F2",
    "terminalToggle": "Ctrl+`",
    "terminalNew": "Ctrl+Shift+`",
    "terminalClose": "Ctrl+Alt+W",
}


SETTINGS_DEFAULTS = {
    "search_ignore": list(SEARCH_IGNORE_DEFAULTS),
    "editor_theme": "auto",
    "minimap": False,
    "shortcuts": dict(SHORTCUT_DEFAULTS),
}


def clean_tools(tools):
    """只留已知工具的能力信息：缺字段的整条丢掉，值一律转成字符串。"""
    if not isinstance(tools, dict):
        return {}
    out = {}
    node = tools.get("node")
    if isinstance(node, dict) and node.get("root") and node.get("id"):
        out["node"] = {"root": str(node["root"]), "id": str(node["id"])}
    jvm = tools.get("jvm")
    if isinstance(jvm, dict) and jvm.get("root") and jvm.get("kind") and jvm.get("id"):
        out["jvm"] = {
            "root": str(jvm["root"]),
            "kind": str(jvm["kind"]),
            "id": str(jvm["id"]),
        }
    return out


def clean_search_ignore(values):
    """只收目录名：去空白、去重，带路径分隔符的条目丢掉，数量与长度都设上限。"""
    names = []
    for value in values if isinstance(values, (list, tuple)) else []:
        name = str(value).strip()
        if not name or name in (".", "..") or "/" in name or "\\" in name:
            continue
        if len(name) > SEARCH_IGNORE_LEN or name in names:
            continue
        names.append(name)
        if len(names) >= SEARCH_IGNORE_MAX:
            break
    return names


class Workspaces:
    """登记过的工作副本，存在 state.json 里；读写都加锁，多个请求并发加同一目录也只落一条。"""

    def __init__(self, path):
        self.path = Path(path)
        self.lock = threading.Lock()

    def load(self):
        data = read_json(self.path, default=None)
        items = data.get("workspaces") if isinstance(data, dict) else None
        if not isinstance(items, list):
            return []
        items = [w for w in items if isinstance(w, dict) and w.get("id") and w.get("root")]
        # 早先只收 SVN，记录里没有 vcs 字段，按 SVN 认；别名也是后加的。
        for item in items:
            item.setdefault("vcs", "svn")
            item.setdefault("alias", "")
        return items

    def save(self, items):
        write_json(self.path, {"workspaces": items}, indent=2, ensure_ascii=False)

    def find(self, wid):
        for item in self.load():
            if item["id"] == wid:
                return item
        return None

    def add(self, root, tools=None):
        root = os.path.abspath(os.path.expanduser(root))
        if not os.path.isdir(root):
            raise ApiError(400, "目录不存在：%s" % root)
        # 加之前先确认真是工作副本（SVN 或 Git），省得页面里攒一堆查不了东西的目录。
        vcs, info = detect_vcs(root)
        with self.lock:
            items = self.load()
            wid = hashlib.md5(root.encode("utf-8")).hexdigest()[:8]
            for item in items:
                if item["root"] == root:
                    # 地址换了（切分支、仓库迁移）、版本控制类型变了时跟着更新。
                    changed = item.get("vcs") != vcs or (info["url"] and item.get("url") != info["url"])
                    if changed:
                        item["vcs"] = vcs
                        if info["url"]:
                            item["url"] = info["url"]
                    # 显式传了 tools 就顺手更新；没传时保留旧值。
                    if tools is not None:
                        item["tools"] = clean_tools(tools)
                        changed = True
                    if changed:
                        self.save(items)
                    return item
            item = {
                "id": wid,
                "root": root,
                "vcs": vcs,
                "url": info["url"],
                "alias": "",
                "added": int(time.time()),
            }
            # 没传 tools 就不写这一项，列出来时是 None，前端据此只自动探测一次。
            if tools is not None:
                item["tools"] = clean_tools(tools)
            items.append(item)
            self.save(items)
            return item

    def remove(self, wid):
        with self.lock:
            items = self.load()
            gone = [item for item in items if item["id"] == wid]
            if not gone:
                raise ApiError(404, "没有这个工作区：%s" % wid)
            self.save([item for item in items if item["id"] != wid])
            return gone[0]

    def tools(self, wid):
        """工作区检测到的工具映射；没这项或没有能力时都当空。"""
        item = self.find(wid)
        value = item.get("tools") if item else None
        return value if isinstance(value, dict) else {}

    def set_tools(self, wid, tools):
        """整份替换工作区的工具映射。"""
        cleaned = clean_tools(tools)
        with self.lock:
            items = self.load()
            for item in items:
                if item["id"] == wid:
                    item["tools"] = cleaned
                    self.save(items)
                    return
            raise ApiError(404, "没有这个工作区：%s" % wid)

    def set_alias(self, wid, alias):
        alias = " ".join((alias or "").split())
        if len(alias) > 80:
            raise ApiError(400, "别名太长，最多 80 个字")
        with self.lock:
            items = self.load()
            for item in items:
                if item["id"] == wid:
                    item["alias"] = alias
                    self.save(items)
                    return
            raise ApiError(404, "没有这个工作区：%s" % wid)

    def workspaces(self):
        # 早先登记的地址可能是百分号编码的，列出来之前统一还原成原文。
        home = os.path.expanduser("~")
        out = []
        for w in self.load():
            try:
                rel = os.path.relpath(w["root"], home)
            except (TypeError, ValueError):
                rel = w["root"]
            out.append(
                {
                    "id": w["id"],
                    "root": w["root"],
                    "vcs": w.get("vcs", "svn"),
                    "url": unquote(w.get("url", "")),
                    "alias": w.get("alias", ""),
                    # 旧记录没有这项，给 None；检测过但没有能力时是 {}。
                    "tools": w.get("tools") if isinstance(w.get("tools"), dict) else None,
                    "rel": rel,
                }
            )
        return out


class Settings:
    """全局设置，存在 settings.json 里：搜索跳过目录、编辑器配色与默认视图。"""

    def __init__(self, path):
        self.path = Path(path)
        self.lock = threading.Lock()

    def data(self):
        value = read_json(self.path, default=None)
        return value if isinstance(value, dict) else {}

    def search_ignore(self):
        values = self.data().get("search_ignore")
        if not isinstance(values, list):
            return list(SEARCH_IGNORE_DEFAULTS)
        return clean_search_ignore(values)

    def editor_theme(self):
        value = self.data().get("editor_theme")
        return value if value in EDITOR_THEMES else SETTINGS_DEFAULTS["editor_theme"]

    def minimap(self):
        return bool(self.data().get("minimap"))

    def shortcuts(self):
        saved = self.data().get("shortcuts")
        if not isinstance(saved, dict):
            return dict(SHORTCUT_DEFAULTS)
        return {**SHORTCUT_DEFAULTS, **{key: saved[key] for key in SHORTCUT_DEFAULTS if key in saved}}

    def payload(self):
        return {
            "search_ignore": self.search_ignore(),
            "defaults": dict(
                SETTINGS_DEFAULTS,
                search_ignore=list(SETTINGS_DEFAULTS["search_ignore"]),
                shortcuts=dict(SHORTCUT_DEFAULTS),
            ),
            "editor_theme": self.editor_theme(),
            "minimap": self.minimap(),
            "shortcuts": self.shortcuts(),
        }

    def set_search_ignore(self, values):
        """只改搜索名单，保留其余设置。"""
        names = clean_search_ignore(values)
        with self.lock:
            data = self.data()
            data["search_ignore"] = names
            write_json(self.path, data, indent=2, ensure_ascii=False)
        return names

    def update(self, body):
        """按页面提交的字段更新设置；没提到的字段保持原值。"""
        with self.lock:
            data = self.data()
            if "search_ignore" in body:
                data["search_ignore"] = clean_search_ignore(body.get("search_ignore") or [])
            if "editor_theme" in body:
                theme = str(body.get("editor_theme") or "")
                data["editor_theme"] = theme if theme in EDITOR_THEMES else "auto"
            if "minimap" in body:
                data["minimap"] = bool(body.get("minimap"))
            if "shortcuts" in body:
                data["shortcuts"] = clean_shortcuts(body.get("shortcuts"))
            write_json(self.path, data, indent=2, ensure_ascii=False)
        return self.payload()


def clean_shortcuts(values):
    """快捷键按登记表收：未知项丢掉，写坏的值退回默认，空串表示停用。"""
    out = dict(SHORTCUT_DEFAULTS)
    if not isinstance(values, dict):
        return out
    for key in SHORTCUT_DEFAULTS:
        value = values.get(key)
        if not isinstance(value, str):
            continue
        text = " ".join(value.split())
        out[key] = text if len(text) <= 40 else SHORTCUT_DEFAULTS[key]
    return out
