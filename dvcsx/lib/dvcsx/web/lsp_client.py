"""代码索引的 LSP 桥接：按语言拉起语言服务器，问定义，把结果换回工作副本相对路径。

只用标准库；一个语言服务器一条子进程 io 会话，帧是 Content-Length + UTF-8 JSON。
管理器按（工作区, 语言）懒启动，空闲回收，服务退出时全部停掉。
"""

import json
import os
import queue
import shutil
import signal
import subprocess
import sys
import threading
import time
from urllib.parse import quote, unquote, urlparse

# 结果最多回这么多条，够页面列候选了。
MAX_LOCATIONS = 20
# 语言 -> 服务器。命令只从这张表来，测试可以整份替换。
SERVERS = {
    "shell": {
        "title": "Shell",
        "language": "shellscript",
        "command": ("bash-language-server", "start"),
        "hint": "npm i -g bash-language-server",
        "suffixes": (".sh", ".bash", ".zsh"),
    },
    "python": {
        "title": "Python",
        "language": "python",
        "command": ("pyright-langserver", "--stdio"),
        "hint": "npm i -g pyright",
        "suffixes": (".py", ".pyi"),
    },
    "typescript": {
        "title": "JS / TS",
        "language": "typescript",
        "command": ("typescript-language-server", "--stdio"),
        "hint": "npm i -g typescript typescript-language-server",
        "suffixes": (".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"),
    },
    "vue": {
        "title": "Vue",
        "language": "vue",
        # 首次查到定义要等它扫完项目，给宽一点。
        "timeout": 30.0,
        "command": ("vue-language-server", "--stdio"),
        "hint": "npm i -g @vue/language-server",
        # 这个服务器要 VSCode 那边的 tsserver 插件桥才会回定义，通用 LSP 客户端接到会一直等。
        "unsupported": "Vue 单文件组件要 VSCode 的 tsserver 插件桥，这一版没接；先用搜索找定义",
        "suffixes": (".vue",),
    },
    "java": {
        "title": "Java",
        "language": "java",
        "timeout": 60.0,
        "command": ("jdtls",),
        "hint": "装 Eclipse JDT LS，把 jdtls 放进 PATH",
        "suffixes": (".java",),
    },
}

# 语言服务器大多是 node 启动的脚本，路径里要有 node 与它们的软链；这两处是稳定的。
STABLE_BIN = (
    os.path.expanduser("~/.local/bin"),
    os.path.expanduser("~/.local/share/fnm/aliases/default/bin"),
)


_TS_CACHE = {"done": False, "path": ""}


def typescript_lib():
    """找全局 typescript 的 lib 目录：项目里没装依赖时，JS 与 Vue 服务器要靠它。"""
    if _TS_CACHE["done"]:
        return _TS_CACHE["path"]
    _TS_CACHE["done"] = True
    # dvcsx 自己装的一份 TypeScript 5：语言服务器只认带 tsserver.js 的版本，
    # 全局那份可能是 TypeScript 7（原生实现，没有 tsserver.js）。
    candidates = [os.path.expanduser("~/.local/share/dvcsx/ts/node_modules/typescript/lib")]
    try:
        found = subprocess.run(
            ["npm", "root", "-g"],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            timeout=10,
        )
        root = found.stdout.decode("utf-8", "replace").strip()
        if root:
            candidates.append(os.path.join(root, "typescript", "lib"))
    except (OSError, subprocess.SubprocessError):
        pass
    versions = os.path.expanduser("~/.local/share/fnm/node-versions")
    if os.path.isdir(versions):
        for name in sorted(os.listdir(versions)):
            candidates.append(
                os.path.join(versions, name, "installation", "lib", "node_modules", "typescript", "lib")
            )
    for path in candidates:
        if os.path.isfile(os.path.join(path, "tsserver.js")):
            _TS_CACHE["path"] = path
            return path
    return ""


class LspError(Exception):
    """LSP 会话出错：超时、服务器退出、回话里带 error。"""


class LspUnavailable(LspError):
    """这种文件没有对应的语言服务器，或者服务器没装。"""


def server_key(path):
    """按扩展名找语言，找不到返回空串。"""
    suffix = os.path.splitext(str(path or ""))[1].lower()
    for key, entry in SERVERS.items():
        if suffix in entry["suffixes"]:
            return key
    return ""


def language_id(key, path):
    suffix = os.path.splitext(str(path or ""))[1].lower()
    if key == "typescript":
        if suffix == ".tsx":
            return "typescriptreact"
        if suffix == ".jsx":
            return "javascriptreact"
        if suffix in (".ts", ".mts", ".cts"):
            return "typescript"
        return "javascript"
    return SERVERS[key]["language"]


def encode_message(payload):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    return b"Content-Length: %d\r\n\r\n%s" % (len(body), body)


def read_message(stream):
    """读一条 LSP 消息；流结束或头坏了返回 None。"""
    headers = {}
    while True:
        line = stream.readline()
        if not line:
            return None
        text = line.decode("ascii", "replace").strip() if isinstance(line, bytes) else line.strip()
        if not text:
            break
        name, _, value = text.partition(":")
        headers[name.strip().lower()] = value.strip()
    try:
        length = int(headers.get("content-length") or 0)
    except ValueError:
        return None
    if length <= 0:
        return None
    body = stream.read(length)
    if not body:
        return None
    try:
        return json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, ValueError):
        return None


def path_to_uri(path):
    return "file://" + quote(str(path), safe="/~")


def uri_to_path(uri):
    if not isinstance(uri, str) or not uri.startswith("file://"):
        return None
    return unquote(urlparse(uri).path)


def inside(root, target):
    try:
        return os.path.commonpath([os.path.abspath(root), os.path.abspath(target)]) == os.path.abspath(root)
    except ValueError:
        return False


def normalize_locations(result, root):
    """把 Location / Location[] / LocationLink[] 换成工作副本相对路径，去重并过滤越界。"""
    items = []
    if isinstance(result, dict):
        items = [result]
    elif isinstance(result, list):
        items = result
    out = []
    seen = set()
    for item in items:
        if not isinstance(item, dict):
            continue
        uri = item.get("targetUri") or item.get("uri")
        rng = item.get("targetSelectionRange") or item.get("targetRange") or item.get("range") or {}
        path = uri_to_path(uri)
        if not path or not inside(root, path):
            continue
        start = (rng or {}).get("start") or {}
        try:
            line = int(start.get("line", 0))
            character = int(start.get("character", 0))
        except (TypeError, ValueError):
            continue
        rel = os.path.relpath(path, root).replace(os.sep, "/")
        mark = (rel, line, character)
        if mark in seen:
            continue
        seen.add(mark)
        out.append({"path": rel, "line": line, "character": character})
        if len(out) >= MAX_LOCATIONS:
            break
    return out


class LspServer:
    """一条 LSP 会话。请求串行由调用方保证，这里只管协议。"""

    def __init__(self, command, root, name, init_timeout=30.0, request_timeout=10.0, options=None):
        self.name = name
        self.root = os.path.abspath(root)
        self.command = list(command)
        self.init_timeout = init_timeout
        self.request_timeout = request_timeout
        self.options = options or {}
        self.pending = {}
        self.next_id = 0
        self.lock = threading.Lock()
        self.write_lock = threading.Lock()
        self.doc_lock = threading.Lock()
        self.versions = {}
        self.texts = {}
        self.stderr_tail = []
        env = os.environ.copy()
        extra = [path for path in STABLE_BIN if os.path.isdir(path)]
        env["PATH"] = os.pathsep.join(extra + [env.get("PATH", "")])
        try:
            self.proc = subprocess.Popen(
                self.command,
                cwd=self.root,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                start_new_session=True,
                env=env,
            )
        except OSError as exc:
            raise LspUnavailable("起不了 %s 语言服务器：%s" % (name, exc))
        threading.Thread(target=self._read_loop, daemon=True).start()
        threading.Thread(target=self._read_err, daemon=True).start()
        try:
            self._initialize()
        except LspError:
            self.stop()
            raise

    def _read_loop(self):
        stream = self.proc.stdout
        while True:
            message = read_message(stream)
            if message is None:
                break
            if "id" in message and ("result" in message or "error" in message):
                with self.lock:
                    slot = self.pending.pop(message["id"], None)
                if slot is not None:
                    slot.put(message)
                continue
            if "id" in message and "method" in message:
                self._answer(message)
        with self.lock:
            slots = list(self.pending.values())
            self.pending.clear()
        for slot in slots:
            slot.put({"error": {"message": "语言服务器退出了"}})

    def _read_err(self):
        for raw in iter(self.proc.stderr.readline, b""):
            text = raw.decode("utf-8", "replace").rstrip()
            if not text:
                continue
            self.stderr_tail.append(text)
            del self.stderr_tail[:-40]

    def _answer(self, message):
        """服务器反向发过来的请求：能回的都回，免得它等在那儿不动。"""
        method = message.get("method")
        params = message.get("params") or {}
        result = None
        if method == "workspace/configuration":
            result = [None] * len(params.get("items") or [])
        elif method == "workspace/applyEdit":
            result = {"applied": False}
        self._send({"jsonrpc": "2.0", "id": message["id"], "result": result})

    def _send(self, payload):
        try:
            with self.write_lock:
                self.proc.stdin.write(encode_message(payload))
                self.proc.stdin.flush()
        except (BrokenPipeError, ValueError, OSError) as exc:
            raise LspError("语言服务器 %s 已经退出：%s" % (self.name, exc))

    def request(self, method, params, timeout=None):
        with self.lock:
            self.next_id += 1
            rid = self.next_id
            slot = queue.Queue()
            self.pending[rid] = slot
        self._send({"jsonrpc": "2.0", "id": rid, "method": method, "params": params})
        wait = self.request_timeout if timeout is None else timeout
        try:
            message = slot.get(timeout=wait)
        except queue.Empty:
            with self.lock:
                self.pending.pop(rid, None)
            raise LspError("语言服务器 %s 超过 %d 秒没回话" % (self.name, wait))
        if "error" in message and message["error"]:
            text = message["error"].get("message") if isinstance(message["error"], dict) else message["error"]
            raise LspError(str(text or "语言服务器报错"))
        return message.get("result")

    def notify(self, method, params):
        self._send({"jsonrpc": "2.0", "method": method, "params": params})

    def _initialize(self):
        root_uri = path_to_uri(self.root)
        params = {
            "processId": os.getpid(),
            "rootPath": self.root,
            "rootUri": root_uri,
            "capabilities": {
                "textDocument": {
                    "synchronization": {"dynamicRegistration": False, "didSave": False},
                    "definition": {"dynamicRegistration": False, "linkSupport": True},
                },
                "workspace": {"configuration": True, "workspaceFolders": True},
            },
            "workspaceFolders": [{"uri": root_uri, "name": os.path.basename(self.root)}],
        }
        if self.options:
            params["initializationOptions"] = self.options
        self.request("initialize", params, timeout=self.init_timeout)
        self.notify("initialized", {})

    def sync(self, path, text, language):
        """把浏览器里这份文本交给服务器：第一次 didOpen，之后有变化发 didChange。"""
        uri = path_to_uri(path)
        with self.doc_lock:
            version = self.versions.get(uri)
            if version is None:
                self.versions[uri] = 1
                self.texts[uri] = text
                self.notify(
                    "textDocument/didOpen",
                    {
                        "textDocument": {
                            "uri": uri,
                            "languageId": language,
                            "version": 1,
                            "text": text,
                        }
                    },
                )
                return
            if self.texts.get(uri) == text:
                return
            version += 1
            self.versions[uri] = version
            self.texts[uri] = text
            self.notify(
                "textDocument/didChange",
                {
                    "textDocument": {"uri": uri, "version": version},
                    "contentChanges": [{"text": text}],
                },
            )

    def query(self, method, path, text, language, line, character, extra=None):
        self.sync(path, text, language)
        params = {
            "textDocument": {"uri": path_to_uri(path)},
            "position": {"line": line, "character": character},
        }
        if extra:
            params.update(extra)
        return self.request(method, params, timeout=self.request_timeout)

    def definition(self, path, text, language, line, character):
        return self.query(
            "textDocument/definition", path, text, language, line, character
        )

    def stop(self):
        try:
            self.request("shutdown", None, timeout=3)
        except LspError:
            pass
        try:
            self.notify("exit", None)
        except LspError:
            pass
        try:
            self.proc.stdin.close()
        except (OSError, ValueError):
            pass
        try:
            self.proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            try:
                os.killpg(os.getpgid(self.proc.pid), signal.SIGTERM)
            except OSError:
                pass
            try:
                self.proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                try:
                    os.killpg(os.getpgid(self.proc.pid), signal.SIGKILL)
                except OSError:
                    pass
        for stream in (self.proc.stdout, self.proc.stderr):
            try:
                stream.close()
            except (OSError, ValueError):
                pass


class _Instance:
    def __init__(self, ws, key, server):
        self.ws = ws
        self.key = key
        self.server = server
        self.last_used = time.time()
        self.lock = threading.Lock()


class LspManager:
    """按（工作区, 语言）管理语言服务器进程。"""

    def __init__(self, commands=None, idle=600.0, max_per_ws=2):
        override = commands or {}
        self.commands = {
            key: tuple(override.get(key) or entry["command"]) for key, entry in SERVERS.items()
        }
        self.idle = idle
        self.max_per_ws = max_per_ws
        self.instances = {}
        self.starting = {}
        self.lock = threading.Lock()
        self.stopped = False
        threading.Thread(target=self._reap, daemon=True).start()

    def status(self):
        rows = []
        for key, entry in SERVERS.items():
            command = self.commands[key]
            supported = not entry.get("unsupported")
            rows.append(
                {
                    "id": key,
                    "title": entry["title"],
                    "command": " ".join(command),
                    "supported": supported,
                    "available": supported and bool(shutil.which(command[0])),
                    "hint": entry.get("unsupported") or entry["hint"],
                }
            )
        return rows

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
        key = server_key(path)
        if not key:
            raise LspUnavailable("这种文件没有语言服务器：%s" % path)
        if SERVERS[key].get("unsupported"):
            raise LspUnavailable(SERVERS[key]["unsupported"])
        command = self.commands[key]
        if not shutil.which(command[0]):
            entry = SERVERS[key]
            raise LspUnavailable("%s 语言服务器没装：%s" % (entry["title"], entry["hint"]))
        instance = self._instance(ws, key, root)
        full = os.path.join(root, path)
        extra = {"context": {"includeDeclaration": True}} if action == "references" else None
        with instance.lock:
            instance.last_used = time.time()
            raw = instance.server.query(
                method, full, text, language_id(key, path), line, character, extra
            )
            instance.last_used = time.time()
        return {"server": key, "locations": normalize_locations(raw, root)}

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
            try:
                server = LspServer(
                    self.commands[key],
                    root,
                    SERVERS[key]["title"],
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
        """JS 与 Vue 的服务器要指到一份 typescript：项目里没装时用全局那份。"""
        if key not in ("typescript", "vue"):
            return {}
        lib = typescript_lib()
        if not lib:
            return {}
        if key == "typescript":
            return {"tsserver": {"path": lib}}
        return {"typescript": {"tsdk": lib}}

    def _evict(self, ws):
        mine = [(mark, item) for mark, item in self.instances.items() if mark[0] == ws]
        if len(mine) < self.max_per_ws:
            return
        mine.sort(key=lambda pair: pair[1].last_used)
        while mine and len([m for m in self.instances if m[0] == ws]) >= self.max_per_ws:
            mark, item = mine.pop(0)
            self.instances.pop(mark, None)
            threading.Thread(target=item.server.stop, daemon=True).start()

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
                item.server.stop()

    def stop_workspace(self, ws):
        dead = []
        with self.lock:
            for mark, item in list(self.instances.items()):
                if mark[0] == ws:
                    self.instances.pop(mark, None)
                    dead.append(item)
        for item in dead:
            item.server.stop()

    def stop_all(self):
        self.stopped = True
        with self.lock:
            items = list(self.instances.values())
            self.instances.clear()
        for item in items:
            item.server.stop()
