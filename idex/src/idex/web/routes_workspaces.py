# @Author: Himmeltala
# @Date: 2026-11-26 09:29:54
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-26 09:29:54
# @FilePath: \idex\src\idex\web\routes_workspaces.py
# @Description: 工作区列表、登记与设置页的接口。

import os
from pathlib import Path

from web import ApiError, log

from server_common import inside
from settings_schema import defaults_flat, schema_payload
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
    handler._check_write()
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
    handler._check_write()
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
    handler._check_write()
    ws = handler.store.find(str(body.get("ws", "")))
    if ws is None:
        raise ApiError(404, "没有这个工作区")
    handler.store.set_alias(ws["id"], str(body.get("alias", "")))
    return {"ok": True}


def _save_settings(handler, body):
    handler._check_write()
    if handler.settings is None:
        raise ApiError(404, "设置没有起来")
    handler.settings.update(body if isinstance(body, dict) else {})
    return handler._settings_payload()


def _save_groups(handler, body):
    handler._check_write()
    if handler.groups is None:
        raise ApiError(404, "分组结构没有起来")
    # 整份替换：页面改完一次就发整张表，服务端只做清洗。
    return {"ok": True, "groups": handler.groups.set(body.get("nodes") or [])}



class WorkspacesRoutes:
    """分组、设置载荷与目录浏览三个小方法，路由表与上面的处理函数都用得到。"""

    def _local_dirs(self, query):
        """目录列表会露出本机家目录结构，默认只认本机；--allow-write 放开。"""
        self._require_local("浏览本机目录")
        return list_dirs((query.get("path") or [""])[0])

    def _group_nodes(self):
        return self.groups.nodes() if self.groups is not None else []


    def _settings_payload(self):
        if self.settings is None:
            return {
                "version": 2,
                "schema": schema_payload(),
                "values": defaults_flat(),
                "defaults": defaults_flat(),
            }
        return self.settings.payload()

