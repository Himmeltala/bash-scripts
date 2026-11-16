"""工作区登记表：state.json 里存工作区、别名、分组与每行参数。

jvmx 不解析 pom / settings.gradle，目标由 mvnx / gradlex 的 ``--list --json``
给出，这里只保存扫描结果与用户在页面上改过的参数。
"""

import copy
import hashlib
import os
import threading
import time
from pathlib import Path

from fileio import read_json, write_json
from stores import clean_node
from web import ApiError

KIND_MVN = "mvn"
KIND_GRADLE = "gradle"
KINDS = (KIND_MVN, KIND_GRADLE)

# 判断工程类型的标记：Maven 看 pom.xml / mvnw，Gradle 看 settings 与 wrapper。
MVN_MARKERS = ("pom.xml", "mvnw")
GRADLE_MARKERS = ("settings.gradle", "settings.gradle.kts", "gradlew")

# 分组的规模上限与别名长度，与共享层保持一致。
MAX_GROUPS = 2000
MAX_ALIAS = 80

# 每行参数里可以存的键：额外参数、Maven 启动方式、Gradle 的两项构建开关。
ROW_KEYS = ("args", "mode", "refresh")


def workspace_id(root):
    """工作区 id 取根目录的短哈希，跨次稳定，与 mvnx 网页的算法一致。"""
    return hashlib.md5(str(root).encode("utf-8")).hexdigest()[:12]


def detect_project(path):
    """从选中目录向上找工程根，返回 (根目录, 类型)；两边的标记都没有就拒绝。

    一个目录里同时有 Maven 与 Gradle 标记时无法可靠判断，直接报出来让用户选别处，
    不替用户挑一种。
    """
    try:
        current = Path(os.path.expanduser(str(path))).resolve()
    except OSError as exc:
        raise ApiError(400, "目录解析失败：%s" % exc)
    if not current.is_dir():
        raise ApiError(400, "不是目录：%s" % path)

    while True:
        mvn = [name for name in MVN_MARKERS if (current / name).is_file()]
        gradle = [name for name in GRADLE_MARKERS if (current / name).is_file()]
        if mvn and gradle:
            raise ApiError(
                400,
                "目录 %s 同时有 Maven 与 Gradle 标记（%s、%s），无法判断工程类型"
                % (current, mvn[0], gradle[0]),
            )
        if mvn:
            return str(current), KIND_MVN
        if gradle:
            return str(current), KIND_GRADLE
        parent = current.parent
        if parent == current:
            break
        current = parent
    raise ApiError(
        400,
        "这个目录及其上级都没有 pom.xml/mvnw 或 settings.gradle(.kts)/gradlew，"
        "不是 Maven 或 Gradle 工程",
    )


def service_id(ws, target):
    """服务 id 带工作区前缀，页面回传时不会撞到别的工作区里的同名目标。"""
    return "%s.%s:%s" % (ws["id"], target.get("command", ""), target.get("tag", ""))


def normalize_alias(value):
    return " ".join(str(value or "").split())


def clean_targets(items, kind):
    """只收形状认得出的目标；命令必须是这个工程类型认识的几种。"""
    allowed = {"mvn": ("run", "war", "install", "package"), "gradle": ("run", "build")}[kind]
    out = []
    seen = set()
    for item in items or []:
        if not isinstance(item, dict):
            continue
        tag = str(item.get("tag") or "").strip()
        command = str(item.get("command") or "").strip()
        if not tag or command not in allowed:
            continue
        if (command, tag) in seen:
            raise ApiError(500, "扫描结果里有重复的目标：%s:%s" % (command, tag))
        seen.add((command, tag))
        out.append(
            {
                "id": str(item.get("id") or "%s:%s" % (command, tag)),
                "command": command,
                "tag": tag,
                "path": str(item.get("path") or ""),
                "cwd": str(item.get("cwd") or ""),
                "display": str(item.get("display") or ""),
            }
        )
    return out


class Store:
    """state.json 的读写；每次整体替换，读的人要么看到旧的整份，要么看到新的整份。"""

    def __init__(self, path):
        self.path = Path(path)
        self.lock = threading.RLock()

    def _read(self):
        data = read_json(self.path, default=None)
        if not isinstance(data, dict):
            data = {}
        workspaces = data.get("workspaces")
        if not isinstance(workspaces, list):
            workspaces = []
        groups = data.get("groups")
        if not isinstance(groups, list):
            groups = []
        return {
            "workspaces": [
                item
                for item in workspaces
                if isinstance(item, dict) and item.get("id") and item.get("root")
            ],
            "groups": [item for item in groups if isinstance(item, dict)],
        }

    def _write(self, data):
        write_json(self.path, data)

    def workspaces(self):
        with self.lock:
            return copy.deepcopy(self._read()["workspaces"])

    def groups(self):
        with self.lock:
            return copy.deepcopy(self._read()["groups"])

    def find(self, ws_id):
        for item in self.workspaces():
            if item["id"] == ws_id:
                return item
        return None

    def add(self, root, kind):
        """登记一个工作区；同一个根已有的保留别名、JDK 与页面参数，只重扫目标。"""
        root = str(root)
        ws_id = workspace_id(root)
        with self.lock:
            data = self._read()
            for item in data["workspaces"]:
                if item["id"] == ws_id or item["root"] == root:
                    item["root"] = root
                    item["kind"] = kind
                    item["added"] = int(time.time())
                    item.setdefault("alias", "")
                    item.setdefault("jdk", "")
                    item.setdefault("rows", {})
                    item["scan_error"] = ""
                    self._write(data)
                    return copy.deepcopy(item)
            item = {
                "id": ws_id,
                "root": root,
                "kind": kind,
                "added": int(time.time()),
                "alias": "",
                "jdk": "",
                "targets": [],
                "rows": {},
                "scanned": 0,
                "scan_error": "",
            }
            data["workspaces"].append(item)
            self._write(data)
            return copy.deepcopy(item)

    def set_targets(self, ws_id, targets, error=""):
        with self.lock:
            data = self._read()
            for item in data["workspaces"]:
                if item["id"] != ws_id:
                    continue
                item["targets"] = targets
                item["scanned"] = int(time.time()) if not error else item.get("scanned", 0)
                item["scan_error"] = error
                self._write(data)
                return copy.deepcopy(item)
        raise ApiError(404, "没有这个工作区：%s" % ws_id)

    def remove(self, ws_id):
        with self.lock:
            data = self._read()
            kept = [item for item in data["workspaces"] if item["id"] != ws_id]
            if len(kept) == len(data["workspaces"]):
                return None
            removed = [item for item in data["workspaces"] if item["id"] == ws_id][0]
            data["workspaces"] = kept
            # 工作区没了，指向它的分组节点也一并清掉。
            data["groups"] = [
                node
                for node in data["groups"]
                if not (node.get("kind") == "ws" and node.get("id") == ws_id)
            ]
            self._write(data)
            return copy.deepcopy(removed)

    def set_alias(self, ws_id, alias):
        alias = normalize_alias(alias)
        if len(alias) > MAX_ALIAS:
            raise ApiError(400, "别名太长，最多 %s 个字" % MAX_ALIAS)
        with self.lock:
            data = self._read()
            for item in data["workspaces"]:
                if item["id"] == ws_id:
                    item["alias"] = alias
                    self._write(data)
                    return
        raise ApiError(404, "没有这个工作区：%s" % ws_id)

    def set_jdk(self, ws_id, jdk):
        with self.lock:
            data = self._read()
            for item in data["workspaces"]:
                if item["id"] == ws_id:
                    item["jdk"] = str(jdk or "")
                    self._write(data)
                    return
        raise ApiError(404, "没有这个工作区：%s" % ws_id)

    def row(self, ws_id, svc_id):
        ws = self.find(ws_id)
        if ws is None:
            return {}
        return dict((ws.get("rows") or {}).get(svc_id) or {})

    def set_row(self, ws_id, svc_id, values):
        """只收白名单里的键，页面传别的字段不会落进状态文件。"""
        clean = dict((key, values[key]) for key in ROW_KEYS if key in values)
        with self.lock:
            data = self._read()
            for item in data["workspaces"]:
                if item["id"] != ws_id:
                    continue
                rows = item.setdefault("rows", {})
                current = dict(rows.get(svc_id) or {})
                current.update(clean)
                rows[svc_id] = current
                self._write(data)
                return
        raise ApiError(404, "没有这个工作区：%s" % ws_id)

    def set_groups(self, nodes):
        if not isinstance(nodes, list):
            raise ApiError(400, "分组结构不对")
        if len(nodes) > MAX_GROUPS:
            raise ApiError(400, "节点太多，最多 %s 个" % MAX_GROUPS)
        out = []
        for item in nodes:
            node = clean_node(item)
            if node is not None:
                out.append(node)
        with self.lock:
            data = self._read()
            data["groups"] = out
            self._write(data)
        return copy.deepcopy(out)
