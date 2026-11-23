"""工作区列表、登记与设置页的接口。"""

import os
from pathlib import Path

from web import ApiError, log

from server_common import inside
from server_stores import SEARCH_IGNORE_DEFAULTS
from tool_detect import detect_tools


def list_dirs(raw):
    """目录树：没给路径就列家目录这一层，给了就列它的下一层；只给目录，不递归。"""
    home = os.path.expanduser("~")
    target = os.path.expanduser(raw.strip()) if raw and raw.strip() else home
    target = os.path.abspath(target)
    if not inside(home, target) and target != home:
        raise ApiError(403, "只能浏览家目录内的目录")
    if not os.path.isdir(target):
        raise ApiError(404, "目录不存在：%s" % target)
    entries = []
    try:
        with os.scandir(target) as it:
            for entry in it:
                if not entry.is_dir(follow_symlinks=False):
                    continue
                if entry.name.startswith("."):
                    continue
                entries.append({"name": entry.name, "path": entry.path})
    except OSError as exc:
        raise ApiError(403, "读不了目录：%s" % exc)
    entries.sort(key=lambda e: e["name"].lower())
    return {"home": home, "path": target, "entries": entries}



def _add_workspace(handler, body):
    root = str(body.get("root", "")).strip()
    if not root:
        raise ApiError(400, "没给目录")
    item = handler.store.add(root, tools=detect_tools(root))
    return {"ok": True, "workspace": item}


def _tool_root(item, key):
    tools = item.get("tools") if isinstance(item.get("tools"), dict) else {}
    tool = tools.get(key) if isinstance(tools, dict) else None
    return str(tool.get("root") or "").strip() if isinstance(tool, dict) else ""


def _holds_root(item, key, root):
    """工作区是否还占着这个引擎根：没探测过的同目录工作区也算占着。"""
    tool_root = _tool_root(item, key)
    if tool_root:
        return tool_root == root
    return str(item.get("root") or "").strip() == root


def _release_engines(handler, item, remaining):
    """最后一个指向该引擎根的工作区移出时才注销，别的 idex 工作区可能还在用。"""
    tools = item.get("tools") if isinstance(item.get("tools"), dict) else {}
    engines = (
        ("node", getattr(handler, "node_service", None), "remove_workspace"),
        ("jvm", getattr(handler, "jvm_app", None), "forget_workspace"),
    )
    for key, service, method in engines:
        tool = tools.get(key) if isinstance(tools, dict) else None
        if service is None or not isinstance(tool, dict):
            continue
        root = str(tool.get("root") or "").strip()
        engine_id = str(tool.get("id") or "").strip()
        if not root or not engine_id:
            continue
        if any(_holds_root(other, key, root) for other in remaining):
            continue
        try:
            getattr(service, method)(engine_id)
        except Exception as exc:
            # 引擎可能还没登记过这个工作区；idex 的登记已经移出，不因此回失败。
            log("注销 %s 引擎工作区失败：%r" % (key, exc))


def _forget_workspace(handler, body):
    wid = str(body.get("ws", ""))
    item = handler.store.remove(wid)
    if handler.lsp is not None:
        handler.lsp.stop_workspace(wid)
    _release_engines(handler, item, handler.store.load())
    return {"ok": True, "removed": item}


def _rescan_tools(handler, body):
    handler._check_write()
    ws = handler.store.find(str(body.get("ws", "")))
    if ws is None:
        raise ApiError(404, "没有这个工作区")
    tools = detect_tools(ws["root"])
    handler.store.set_tools(ws["id"], tools)
    return {"ok": True, "tools": tools}


def _set_alias(handler, body):
    ws = handler.store.find(str(body.get("ws", "")))
    if ws is None:
        raise ApiError(404, "没有这个工作区")
    handler.store.set_alias(ws["id"], str(body.get("alias", "")))
    return {"ok": True}


def _save_settings(handler, body):
    if handler.settings is None:
        raise ApiError(404, "设置没有起来")
    handler.settings.set_search_ignore(body.get("search_ignore") or [])
    return handler._settings_payload()


def _save_groups(handler, body):
    if handler.groups is None:
        raise ApiError(404, "分组结构没有起来")
    # 整份替换：页面改完一次就发整张表，服务端只做清洗。
    return {"ok": True, "groups": handler.groups.set(body.get("nodes") or [])}



class WorkspacesRoutes:
    """分组与设置载荷两个小方法，路由表与上面的处理函数都用得到。"""

    def _group_nodes(self):
        return self.groups.nodes() if self.groups is not None else []


    def _settings_payload(self):
        ignore = (
            self.settings.search_ignore()
            if self.settings is not None
            else list(SEARCH_IGNORE_DEFAULTS)
        )
        return {"search_ignore": ignore, "defaults": list(SEARCH_IGNORE_DEFAULTS)}

