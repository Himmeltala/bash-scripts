"""按（工作区, 语言）管理语言服务器：懒启动、空闲回收、五种操作与重命名。"""

import os
import shutil
import threading
import time

from .protocol import (
    LspUnavailable,
    lsp_hover_text,
    normalize_completions,
    normalize_format_edits,
    normalize_locations,
    normalize_symbols,
    normalize_workspace_edit,
    path_to_uri,
)
from .servers import SERVERS, STABLE_BIN, language_id, server_key, typescript_lib, which_node
from .session import LspServer, _Instance, stop_instance
from .vue import TsslsBridge, merge_diagnostics, vue_block


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
            if entry.get("uses_bridge"):
                # Vue 除了自己那个语言服务器，还要起带插件的那份 tsserver。
                script = self.commands["typescript"]
                available = (
                    self._bridge_ready()
                    and self._which(command[0])
                    and self._which(script[0])
                )
                label = " ".join(command) + " + " + " ".join(script)
            else:
                available = self._which(command[0])
                label = " ".join(command)
            rows.append(
                {
                    "id": key,
                    "title": entry["title"],
                    "command": label,
                    "supported": True,
                    "available": bool(available),
                    "hint": entry["hint"],
                    "capabilities": entry.get("capabilities", {}),
                }
            )
        return rows

    def _which(self, name):
        """按页面进程的 PATH 找命令；STABLE_BIN 里那份也算。"""
        extra = [path for path in STABLE_BIN if os.path.isdir(path)]
        path = os.pathsep.join(extra + [os.environ.get("PATH", "")])
        return shutil.which(name, path=path)

    def _bridge_ready(self):
        """Vue 的脚本插件能不能用：要看 node、带 tsserver.js 的 TypeScript 与 @vue/typescript-plugin。"""
        if self.bridge_command is not None:
            return bool(self.bridge_command)
        lib = typescript_lib()
        node = which_node()
        if not lib or not node:
            return False
        tsserver = os.path.join(lib, "tsserver.js")
        probe = os.path.dirname(os.path.dirname(lib))
        plugin = os.path.join(probe, "@vue", "typescript-plugin")
        return os.path.isfile(tsserver) and os.path.isdir(plugin)

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
        key, instance, full = self._target(ws, root, path)
        extra = {"context": {"includeDeclaration": True}} if action == "references" else None
        with instance.lock:
            instance.last_used = time.time()
            server = self._server_for(instance, text, line)
            raw = server.query(
                method, full, text, language_id(key, path), line, character, extra
            )
            instance.last_used = time.time()
        return {"server": key, "locations": normalize_locations(raw, root)}

    def completion(self, ws, root, path, text, line, character, trigger=None):
        key, instance, full = self._target(ws, root, path)
        server = self._server_for(instance, text, line)
        if not server.capabilities.get("completionProvider"):
            raise LspUnavailable("%s 语言服务器不支持补全" % SERVERS[key]["title"])
        with instance.lock:
            instance.last_used = time.time()
            raw = server.completion(
                full, text, language_id(key, path), line, character, trigger
            )
            instance.last_used = time.time()
        data = normalize_completions(raw)
        return {"server": key, "items": data["items"], "incomplete": data["incomplete"]}

    def formatting(self, ws, root, path, text, options):
        key, instance, full = self._target(ws, root, path)
        # Vue 的格式化要整份单文件组件一起改，只能交给 Vue 语言服务器。
        server = instance.server
        if not server.capabilities.get("documentFormattingProvider"):
            raise LspUnavailable("%s 语言服务器不支持格式化" % SERVERS[key]["title"])
        with instance.lock:
            instance.last_used = time.time()
            raw = server.formatting(
                full, text, language_id(key, path), options
            )
            instance.last_used = time.time()
        return {"server": key, "edits": normalize_format_edits(raw)}

    def hover(self, ws, root, path, text, line, character):
        key, instance, full = self._target(ws, root, path)
        with instance.lock:
            instance.last_used = time.time()
            server = self._server_for(instance, text, line)
            raw = server.hover(full, text, language_id(key, path), line, character)
            instance.last_used = time.time()
        return {"server": key, "hover": {"text": lsp_hover_text(raw)}}

    def diagnostics(self, ws, root, path, text):
        """把文件交给服务器，返回当前攒下的诊断；服务器是异步推的，前端隔一会儿再取。"""
        key, instance, full = self._target(ws, root, path)
        language = language_id(key, path)
        with instance.lock:
            instance.last_used = time.time()
            instance.server.sync(full, text, language)
            templ = instance.server.snapshot(path_to_uri(full))
            script = []
            if instance.script is not None:
                instance.script.sync(full, text, language)
                script = instance.script.snapshot(path_to_uri(full))
            instance.last_used = time.time()
        items = merge_diagnostics(templ, script)
        return {"server": key, "diagnostics": items}

    def symbols(self, ws, root, path, text):
        """整份文件的符号大纲；Vue 由语言服务器给出模板结构。"""
        key, instance, full = self._target(ws, root, path)
        server = instance.server
        with instance.lock:
            instance.last_used = time.time()
            raw = server.documentsymbol(full, text, language_id(key, path))
            instance.last_used = time.time()
        return {"server": key, "symbols": normalize_symbols(raw)}

    def rename_plan(self, ws, root, path, text, line, character, new_name):
        """问一次重命名，把结果整理成要改的文件与改动；这里不动磁盘。"""
        name = str(new_name or "").strip()
        if not name or len(name) > 200 or "\n" in name:
            raise LspUnavailable("新名字不能为空，也不能换行")
        key, instance, full = self._target(ws, root, path)
        language = language_id(key, path)
        with instance.lock:
            instance.last_used = time.time()
            server = self._server_for(instance, text, line)
            first = server.rename(full, text, language, line, character, name)
            second = first
            if self.rename_warm:
                # 第一次请求会让服务器把项目分析起来，稍等再问一次拿完整结果。
                time.sleep(self.rename_warm)
                second = server.rename(full, text, language, line, character, name)
            instance.last_used = time.time()
        plans = [normalize_workspace_edit(first, root), normalize_workspace_edit(second, root)]
        plan = max(plans, key=lambda item: sum(len(entry["edits"]) for entry in item))
        return {"server": key, "plan": plan}

    def _target(self, ws, root, path):
        """一次拿齐实例、语言键与文件全路径；六个操作都从这里起手。"""
        key = self._ready(path)
        return key, self._instance(ws, key, root), os.path.join(root, path)

    def _ready(self, path):
        """这个文件能不能查：有对应的语言、服务器受支持且装好了。"""
        key = server_key(path)
        if not key:
            raise LspUnavailable("这种文件没有语言服务器：%s" % path)
        entry = SERVERS[key]
        command = self.commands[key]
        if entry.get("uses_bridge") and not self._bridge_ready():
            raise LspUnavailable(entry["hint"])
        if not self._which(command[0]):
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
            script = None
            bridge = None
            if SERVERS[key].get("uses_bridge"):
                if not self._bridge_ready():
                    with self.lock:
                        self.starting.pop(mark, None)
                    raise LspUnavailable(SERVERS[key]["hint"])
                # 脚本那半由 typescript-language-server 加 Vue 插件处理；
                # Vue 语言服务器问的 tsserver 命令也转给它。
                try:
                    script = LspServer(
                        list(self.commands["typescript"]),
                        root,
                        "Vue TypeScript",
                        init_timeout=SERVERS["typescript"].get("init_timeout", 30.0),
                        request_timeout=SERVERS["typescript"].get("timeout", 10.0),
                        options=self._vue_script_options(),
                    )
                except Exception:
                    with self.lock:
                        self.starting.pop(mark, None)
                    raise
                bridge = TsslsBridge(script)
            command = list(self.commands[key])
            try:
                server = LspServer(
                    command,
                    root,
                    SERVERS[key]["title"],
                    init_timeout=SERVERS[key].get("init_timeout", 30.0),
                    request_timeout=SERVERS[key].get("timeout", 10.0),
                    options=self._options(key),
                    bridge=bridge,
                )
            except Exception:
                if script is not None:
                    script.stop()
                with self.lock:
                    self.starting.pop(mark, None)
                raise
            instance = _Instance(ws, key, server, bridge, script)
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

    def _vue_script_options(self):
        """Vue 的脚本服务器：同一份 typescript-language-server，加上 Vue 插件。"""
        options = self._options("typescript")
        lib = typescript_lib()
        if lib:
            plugin = os.path.join(os.path.dirname(os.path.dirname(lib)), "@vue", "typescript-plugin")
            options["plugins"] = [
                {"name": "@vue/typescript-plugin", "location": plugin, "languages": ["vue"]}
            ]
        return options

    def _server_for(self, instance, text, line):
        """Vue 按块分工：脚本走 TypeScript 服务器，模板与样式走 Vue 服务器。"""
        if instance.script is None:
            return instance.server
        if vue_block(text, line) == "script":
            return instance.script
        return instance.server

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

