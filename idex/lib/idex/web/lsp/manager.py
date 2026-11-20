"""按（工作区, 语言）管理语言服务器：懒启动、空闲回收、五种操作与重命名。"""

import os
import shutil
import threading
import time

from .protocol import (
    LspError,
    LspUnavailable,
    lsp_hover_text,
    normalize_locations,
    normalize_symbols,
    normalize_workspace_edit,
    path_to_uri,
    tsserver_diagnostics,
    tsserver_hover_text,
    tsserver_locations,
    tsserver_rename_plan,
    tsserver_symbols,
)
from .servers import SERVERS, language_id, server_key, typescript_lib, which_node
from .session import LspServer, _Instance, stop_instance
from .tsserver import TsserverBridge


class LspManager:
    """按（工作区, 语言）管理语言服务器进程。"""

    def __init__(
        self,
        commands=None,
        idle=600.0,
        max_per_ws=2,
        rename_warm=1.0,
        bridge_command=None,
    ):
        override = commands or {}
        self.commands = {
            key: tuple(override.get(key) or entry["command"]) for key, entry in SERVERS.items()
        }
        self.idle = idle
        self.max_per_ws = max_per_ws
        # pyright 这类服务器要问过一次才开始分析整个项目，重命名第一次问会漏掉没开过的文件。
        self.rename_warm = rename_warm
        # 测试里可以关掉 Vue 的 tsserver 桥；None 表示按本机情况自己找。
        self.bridge_command = bridge_command
        self.instances = {}
        self.starting = {}
        self.lock = threading.Lock()
        self.stopped = False
        threading.Thread(target=self._reap, daemon=True).start()

    def status(self):
        rows = []
        for key, entry in SERVERS.items():
            command = self.commands[key]
            if entry.get("bridge_only"):
                # Vue 没有单独的服务进程，靠带插件的那份 tsserver。
                available = bool(self._bridge_command())
                rows.append(
                    {
                        "id": key,
                        "title": entry["title"],
                        "command": "tsserver + @vue/typescript-plugin",
                        "supported": True,
                        "available": available,
                        "hint": entry["hint"],
                    }
                )
                continue
            supported = True
            hint = entry["hint"]
            rows.append(
                {
                    "id": key,
                    "title": entry["title"],
                    "command": " ".join(command),
                    "supported": supported,
                    "available": supported and bool(shutil.which(command[0])),
                    "hint": hint,
                }
            )
        return rows

    def _bridge_command(self):
        """带 Vue 插件的 tsserver 的启动命令；缺 node、TypeScript 5 或插件时返回空。"""
        if self.bridge_command is not None:
            return self.bridge_command or None
        lib = typescript_lib()
        node = which_node()
        if not lib or not node:
            return None
        tsserver = os.path.join(lib, "tsserver.js")
        probe = os.path.dirname(os.path.dirname(lib))
        plugin = os.path.join(probe, "@vue", "typescript-plugin")
        if not os.path.isfile(tsserver) or not os.path.isdir(plugin):
            return None
        return [
            node,
            tsserver,
            "--globalPlugins",
            "@vue/typescript-plugin",
            "--pluginProbeLocations",
            probe,
        ]

    # Vue 走 tsserver 时，动作对应的 tsserver 命令名。
    TSSERVER_COMMANDS = {
        "definition": "definition",
        "typeDefinition": "typeDefinition",
        "implementation": "implementation",
        "references": "references",
    }

    # 右键菜单里的动作与 LSP 方法的对应关系。
    ACTIONS = {
        "definition": "textDocument/definition",
        "typeDefinition": "textDocument/typeDefinition",
        "implementation": "textDocument/implementation",
        "references": "textDocument/references",
    }

    def definition(self, ws, root, path, text, line, character):
        return self.query(ws, root, path, text, line, character, "definition")

    def query(self, ws, root, path, text, line, character, action="definition"):
        method = self.ACTIONS.get(action)
        if not method:
            raise LspUnavailable("不认识的动作：%s" % action)
        key = self._ready(path)
        instance = self._instance(ws, key, root)
        full = os.path.join(root, path)
        if SERVERS[key].get("bridge_only"):
            with instance.lock:
                instance.last_used = time.time()
                raw = instance.bridge.forward(
                    self.TSSERVER_COMMANDS[action],
                    {"file": full, "line": line + 1, "offset": character + 1},
                )
                instance.last_used = time.time()
            return {"server": key, "locations": tsserver_locations(raw, root, action)}
        extra = {"context": {"includeDeclaration": True}} if action == "references" else None
        with instance.lock:
            instance.last_used = time.time()
            raw = instance.server.query(
                method, full, text, language_id(key, path), line, character, extra
            )
            instance.last_used = time.time()
        return {"server": key, "locations": normalize_locations(raw, root)}

    def hover(self, ws, root, path, text, line, character):
        key = self._ready(path)
        instance = self._instance(ws, key, root)
        full = os.path.join(root, path)
        if SERVERS[key].get("bridge_only"):
            with instance.lock:
                instance.last_used = time.time()
                raw = instance.bridge.forward(
                    "quickinfo", {"file": full, "line": line + 1, "offset": character + 1}
                )
                instance.last_used = time.time()
            return {"server": key, "hover": {"text": tsserver_hover_text(raw)}}
        with instance.lock:
            instance.last_used = time.time()
            raw = instance.server.hover(full, text, language_id(key, path), line, character)
            instance.last_used = time.time()
        return {"server": key, "hover": {"text": lsp_hover_text(raw)}}

    def diagnostics(self, ws, root, path, text):
        """把文件交给服务器，返回当前攒下的诊断；服务器是异步推的，前端隔一会儿再取。"""
        key = self._ready(path)
        instance = self._instance(ws, key, root)
        full = os.path.join(root, path)
        if SERVERS[key].get("bridge_only"):
            items = []
            with instance.lock:
                instance.last_used = time.time()
                instance.bridge.open(full)
                for command in ("syntacticDiagnosticsSync", "semanticDiagnosticsSync"):
                    try:
                        raw = instance.bridge.request(command, {"file": full}, timeout=15)
                    except LspError:
                        continue
                    items.extend(tsserver_diagnostics(raw))
                instance.last_used = time.time()
            return {"server": key, "diagnostics": items[:200]}
        with instance.lock:
            instance.last_used = time.time()
            instance.server.sync(full, text, language_id(key, path))
            instance.last_used = time.time()
            items = instance.server.snapshot(path_to_uri(full))
        return {"server": key, "diagnostics": items}

    def symbols(self, ws, root, path, text):
        """整份文件的符号大纲：普通服务器问 documentSymbol，Vue 走 tsserver 的 navtree。"""
        key = self._ready(path)
        instance = self._instance(ws, key, root)
        full = os.path.join(root, path)
        if SERVERS[key].get("bridge_only"):
            with instance.lock:
                instance.last_used = time.time()
                raw = instance.bridge.forward("navtree", {"file": full})
                instance.last_used = time.time()
            return {"server": key, "symbols": tsserver_symbols(raw)}
        with instance.lock:
            instance.last_used = time.time()
            raw = instance.server.documentsymbol(full, text, language_id(key, path))
            instance.last_used = time.time()
        return {"server": key, "symbols": normalize_symbols(raw)}

    def rename_plan(self, ws, root, path, text, line, character, new_name):
        """问一次重命名，把结果整理成要改的文件与改动；这里不动磁盘。"""
        name = str(new_name or "").strip()
        if not name or len(name) > 200 or "\n" in name:
            raise LspUnavailable("新名字不能为空，也不能换行")
        key = self._ready(path)
        instance = self._instance(ws, key, root)
        full = os.path.join(root, path)
        if SERVERS[key].get("bridge_only"):
            with instance.lock:
                instance.last_used = time.time()
                raw = instance.bridge.forward(
                    "rename", {"file": full, "line": line + 1, "offset": character + 1}
                )
                instance.last_used = time.time()
            return {"server": key, "plan": tsserver_rename_plan(raw, root, name)}
        language = language_id(key, path)
        with instance.lock:
            instance.last_used = time.time()
            first = instance.server.rename(full, text, language, line, character, name)
            second = first
            if self.rename_warm:
                # 第一次请求会让服务器把项目分析起来，稍等再问一次拿完整结果。
                time.sleep(self.rename_warm)
                second = instance.server.rename(full, text, language, line, character, name)
            instance.last_used = time.time()
        plans = [normalize_workspace_edit(first, root), normalize_workspace_edit(second, root)]
        plan = max(plans, key=lambda item: sum(len(entry["edits"]) for entry in item))
        return {"server": key, "plan": plan}

    def _ready(self, path):
        """这个文件能不能查：有对应的语言、服务器受支持且装好了。"""
        key = server_key(path)
        if not key:
            raise LspUnavailable("这种文件没有语言服务器：%s" % path)
        if SERVERS[key].get("bridge_only"):
            if not self._bridge_command():
                raise LspUnavailable(SERVERS[key]["hint"])
            return key
        command = self.commands[key]
        if not shutil.which(command[0]):
            entry = SERVERS[key]
            raise LspUnavailable("%s 语言服务器没装：%s" % (entry["title"], entry["hint"]))
        return key

    def _instance(self, ws, key, root):
        mark = (ws, key)
        with self.lock:
            found = self.instances.get(mark)
            if found is not None:
                return found
            gate = self.starting.get(mark)
            if gate is None:
                gate = threading.Lock()
                self.starting[mark] = gate
        # 冷启动可能要几十秒（jdtls），这一步不占全局锁，只挡住同一工作区同一语言的并发。
        with gate:
            with self.lock:
                found = self.instances.get(mark)
                if found is not None:
                    return found
                self._evict(ws)
            if SERVERS[key].get("bridge_only"):
                bridge_command = self._bridge_command()
                if not bridge_command:
                    with self.lock:
                        self.starting.pop(mark, None)
                    raise LspUnavailable(SERVERS[key]["hint"])
                bridge = TsserverBridge(bridge_command, root, "Vue tsserver")
                instance = _Instance(ws, key, None, bridge)
                with self.lock:
                    self.instances[mark] = instance
                    self.starting.pop(mark, None)
                return instance
            command = list(self.commands[key])
            try:
                server = LspServer(
                    command,
                    root,
                    SERVERS[key]["title"],
                    init_timeout=SERVERS[key].get("init_timeout", 30.0),
                    request_timeout=SERVERS[key].get("timeout", 10.0),
                    options=self._options(key),
                )
            except Exception:
                with self.lock:
                    self.starting.pop(mark, None)
                raise
            instance = _Instance(ws, key, server)
            with self.lock:
                self.instances[mark] = instance
                self.starting.pop(mark, None)
            return instance

    def _options(self, key):
        """JS 服务器要指到一份 typescript：项目里没装时用全局那份。"""
        if key != "typescript":
            return {}
        lib = typescript_lib()
        return {"tsserver": {"path": lib}} if lib else {}

    def _evict(self, ws):
        mine = [(mark, item) for mark, item in self.instances.items() if mark[0] == ws]
        if len(mine) < self.max_per_ws:
            return
        mine.sort(key=lambda pair: pair[1].last_used)
        while mine and len([m for m in self.instances if m[0] == ws]) >= self.max_per_ws:
            mark, item = mine.pop(0)
            self.instances.pop(mark, None)
            threading.Thread(target=stop_instance, args=(item,), daemon=True).start()

    def _reap(self):
        while not self.stopped:
            time.sleep(30)
            now = time.time()
            dead = []
            with self.lock:
                for mark, item in list(self.instances.items()):
                    if now - item.last_used >= self.idle:
                        self.instances.pop(mark, None)
                        dead.append(item)
            for item in dead:
                stop_instance(item)

    def stop_workspace(self, ws):
        dead = []
        with self.lock:
            for mark, item in list(self.instances.items()):
                if mark[0] == ws:
                    self.instances.pop(mark, None)
                    dead.append(item)
        for item in dead:
            stop_instance(item)

    def stop_all(self):
        self.stopped = True
        with self.lock:
            items = list(self.instances.values())
            self.instances.clear()
        for item in items:
            stop_instance(item)

