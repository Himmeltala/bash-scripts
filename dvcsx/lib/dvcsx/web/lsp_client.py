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
        # 不用单独的服务器：带 @vue/typescript-plugin 的 tsserver 直接认得 .vue，
        # 脚本与模板里的定义、引用、重命名都从它那里拿。
        "command": (),
        "hint": "Vue 要 Node、TypeScript 5 与 @vue/typescript-plugin",
        "bridge_only": True,
        "suffixes": (".vue",),
    },
    "java": {
        "title": "Java",
        "language": "java",
        "timeout": 60.0,
        "init_timeout": 90.0,
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


def which_node():
    path = os.environ.get("PATH", "")
    extra = [item for item in STABLE_BIN if os.path.isdir(item)]
    if extra:
        path = os.pathsep.join(extra + [path])
    return shutil.which("node", path=path)


class TsserverBridge:
    """给 @vue/language-server 用的 tsserver：它反向问的 _vue:* 命令由带 Vue 插件的 tsserver 回答。

    输入一行一条 JSON；tsserver 的输出是 Content-Length 帧，读法同 LSP。
    """

    def __init__(self, command, root, name="tsserver"):
        self.name = name
        self.command = list(command)
        self.root = os.path.abspath(root)
        self.pending = {}
        self.next_id = 0
        self.opened = set()
        self.diagnostics = {}
        self.diag_lock = threading.Lock()
        self.lock = threading.Lock()
        self.write_lock = threading.Lock()
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
            raise LspUnavailable("起不了 tsserver：%s" % exc)
        threading.Thread(target=self._read_loop, daemon=True).start()
        threading.Thread(target=self._read_err, daemon=True).start()
        try:
            self.request("configure", {})
        except LspError:
            self.stop()
            raise

    def _read_loop(self):
        while True:
            message = read_message(self.proc.stdout)
            if message is None:
                break
            if message.get("type") == "event":
                kind = message.get("event")
                body = message.get("body") or {}
                if kind in ("syntaxDiag", "semanticDiag", "suggestionDiag") and body.get("file"):
                    items = []
                    for item in body.get("diagnostics") or []:
                        if not isinstance(item, dict):
                            continue
                        start = item.get("start") or {}
                        try:
                            line = int(start.get("line", 1)) - 1
                            character = int(start.get("offset", 1)) - 1
                        except (TypeError, ValueError):
                            continue
                        category = str(item.get("category") or "error")
                        level = "error" if category == "error" else "warning" if category == "warning" else "info"
                        message = str(item.get("text") or "").strip()
                        if not message:
                            continue
                        items.append(
                            {
                                "severity": level,
                                "line": max(0, line),
                                "character": max(0, character),
                                "message": message[:500],
                                "source": "",
                            }
                        )
                    with self.diag_lock:
                        self.diagnostics[body["file"]] = items[:200]
                continue
            if message.get("type") != "response":
                continue
            with self.lock:
                slot = self.pending.pop(message.get("request_seq"), None)
            if slot is not None:
                slot.put(message)
        with self.lock:
            slots = list(self.pending.values())
            self.pending.clear()
        for slot in slots:
            slot.put({"success": False, "message": "tsserver 退出了"})

    def _read_err(self):
        for _ in iter(self.proc.stderr.readline, b""):
            pass

    def _send(self, payload):
        try:
            with self.write_lock:
                line = json.dumps(payload, ensure_ascii=False) + "\n"
                self.proc.stdin.write(line.encode("utf-8"))
                self.proc.stdin.flush()
        except (BrokenPipeError, ValueError, OSError) as exc:
            raise LspError("tsserver 已经退出：%s" % exc)

    def request(self, command, arguments, timeout=15.0):
        with self.lock:
            self.next_id += 1
            seq = self.next_id
            slot = queue.Queue()
            self.pending[seq] = slot
        self._send({"seq": seq, "type": "request", "command": command, "arguments": arguments})
        try:
            message = slot.get(timeout=timeout)
        except queue.Empty:
            with self.lock:
                self.pending.pop(seq, None)
            raise LspError("tsserver 超过 %d 秒没回话" % timeout)
        if not message.get("success", False):
            raise LspError(str(message.get("message") or "tsserver 报错"))
        return message.get("body")

    def _paths(self, value):
        if isinstance(value, str):
            if value.startswith("file://"):
                path = uri_to_path(value)
                if path and os.path.isfile(path):
                    yield path
            elif os.path.isabs(value) and os.path.isfile(value):
                yield value
        elif isinstance(value, dict):
            for item in value.values():
                yield from self._paths(item)
        elif isinstance(value, (list, tuple)):
            for item in value:
                yield from self._paths(item)

    def _open_paths(self, arguments):
        # tsserver 要先 open 过文件，_vue:* 这些自定义命令才认得那个项目。
        for path in self._paths(arguments):
            if path in self.opened:
                continue
            self.opened.add(path)
            try:
                self.request("open", {"file": path})
            except LspError:
                self.opened.discard(path)

    def open(self, path):
        if path in self.opened:
            return
        self.opened.add(path)
        try:
            self.request("open", {"file": path})
        except LspError:
            self.opened.discard(path)
            raise

    def snapshot(self, path):
        with self.diag_lock:
            return list(self.diagnostics.get(path) or [])

    def forward(self, name, arguments):
        if self.proc.poll() is not None:
            raise LspError("tsserver 已经退出")
        self._open_paths(arguments)
        return self.request(name, arguments)

    def stop(self):
        try:
            self._send({"seq": 0, "type": "request", "command": "exit", "arguments": {}})
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


DIAGNOSTIC_LEVELS = {1: "error", 2: "warning", 3: "info", 4: "hint"}


def normalize_diagnostics(items):
    """LSP 的 Diagnostic[] 换成带严重级别与位置的列表。"""
    out = []
    for item in items or []:
        if not isinstance(item, dict):
            continue
        rng = item.get("range") or {}
        start = rng.get("start") or {}
        try:
            line = int(start.get("line", 0))
            character = int(start.get("character", 0))
        except (TypeError, ValueError):
            continue
        severity = item.get("severity")
        level = DIAGNOSTIC_LEVELS.get(severity, "info") if isinstance(severity, int) else "info"
        message = str(item.get("message") or "").strip()
        if not message:
            continue
        out.append(
            {
                "severity": level,
                "line": max(0, line),
                "character": max(0, character),
                "message": message[:500],
                "source": str(item.get("source") or ""),
            }
        )
        if len(out) >= 200:
            break
    return out


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


SYMBOL_KINDS = {
    1: "file", 2: "module", 3: "namespace", 4: "package", 5: "class", 6: "method",
    7: "property", 8: "field", 9: "constructor", 10: "enum", 11: "interface",
    12: "function", 13: "variable", 14: "constant", 15: "string", 16: "number",
    17: "boolean", 18: "array", 19: "object", 20: "key", 21: "null",
    22: "enumMember", 23: "struct", 24: "event", 25: "operator", 26: "typeParameter",
}


def normalize_symbols(raw):
    """LSP 的 DocumentSymbol[] 或 SymbolInformation[] 摊平成带层级的列表。"""
    out = []

    def walk(items, depth):
        for item in items or []:
            if not isinstance(item, dict):
                continue
            name = str(item.get("name") or "")
            if not name:
                continue
            rng = item.get("selectionRange") or item.get("range")
            if not rng and isinstance(item.get("location"), dict):
                rng = item["location"].get("range")
            start = (rng or {}).get("start") or {}
            try:
                line = int(start.get("line", 0))
                character = int(start.get("character", 0))
            except (TypeError, ValueError):
                line, character = 0, 0
            kind = item.get("kind")
            label = SYMBOL_KINDS.get(kind, "symbol") if isinstance(kind, int) else "symbol"
            if kind is not None and not isinstance(kind, int):
                label = str(kind)
            out.append(
                {
                    "name": name,
                    "kind": label,
                    "line": line,
                    "character": character,
                    "depth": depth,
                }
            )
            if isinstance(item.get("children"), list):
                walk(item["children"], depth + 1)

    if isinstance(raw, list):
        walk(raw, 0)
    return out


def tsserver_symbols(raw):
    """tsserver navtree 的 childItems 摊平成同样的形状。"""
    out = []

    def walk(items, depth):
        for item in items or []:
            if not isinstance(item, dict):
                continue
            name = str(item.get("text") or item.get("name") or "")
            if not name:
                continue
            spans = item.get("spans") or []
            start = (spans[0] or {}).get("start") if spans else item.get("start")
            start = start or {}
            try:
                line = int(start.get("line", 1)) - 1
                character = int(start.get("offset", 1)) - 1
            except (TypeError, ValueError):
                line, character = 0, 0
            out.append(
                {
                    "name": name,
                    "kind": str(item.get("kind") or "symbol"),
                    "line": max(0, line),
                    "character": max(0, character),
                    "depth": depth,
                }
            )
            if isinstance(item.get("childItems"), list):
                walk(item["childItems"], depth + 1)

    body = raw if isinstance(raw, dict) else {}
    walk(body.get("childItems"), 0)
    return out


def tsserver_locations(raw, root, action="definition"):
    """tsserver 的结果换成工作副本相对路径；行列从 1 起换成从 0 起。"""
    if action == "references":
        items = (raw or {}).get("refs") if isinstance(raw, dict) else None
    elif isinstance(raw, list):
        items = raw
    else:
        items = None
    out = []
    seen = set()
    for item in items or []:
        if not isinstance(item, dict):
            continue
        path = item.get("file")
        if not path or not inside(root, path):
            continue
        start = item.get("start") or {}
        try:
            line = int(start.get("line", 1)) - 1
            character = int(start.get("offset", 1)) - 1
        except (TypeError, ValueError):
            continue
        if line < 0 or character < 0:
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


def tsserver_rename_plan(raw, root, new_name):
    """tsserver rename 的 locs 换成 [{path, edits}]，后续与 LSP 的落盘流程共用。"""
    if not isinstance(raw, dict):
        return []
    info = raw.get("info") or {}
    if info and not info.get("canRename", True):
        raise LspError(str(info.get("localizedErrorMessage") or "这里不能重命名"))
    plan = []
    for item in raw.get("locs") or []:
        if not isinstance(item, dict):
            continue
        path = item.get("file")
        if not path or not inside(root, path):
            raise LspUnavailable("重命名的改动落在工作副本外，没处理")
        edits = []
        for loc in item.get("locs") or []:
            start = (loc or {}).get("start") or {}
            end = (loc or {}).get("end") or {}
            try:
                edits.append(
                    {
                        "range": {
                            "start": {
                                "line": int(start.get("line", 1)) - 1,
                                "character": int(start.get("offset", 1)) - 1,
                            },
                            "end": {
                                "line": int(end.get("line", 1)) - 1,
                                "character": int(end.get("offset", 1)) - 1,
                            },
                        },
                        "newText": new_name,
                    }
                )
            except (TypeError, ValueError):
                continue
        if edits:
            rel = os.path.relpath(path, root).replace(os.sep, "/")
            plan.append({"path": rel, "edits": edits})
    return plan


MAX_EDIT_FILE = 512 * 1024


def position_to_index(text, line, character):
    """LSP 的行列换成文本下标：行从 0 起，character 按 UTF-16 单元数算。"""
    if line < 0 or character < 0:
        raise ValueError("行列不能是负数")
    starts = [0]
    for index, char in enumerate(text):
        if char == "\n":
            starts.append(index + 1)
    if line >= len(starts):
        raise ValueError("行超出文件")
    start = starts[line]
    end = starts[line + 1] if line + 1 < len(starts) else len(text)
    count = 0
    index = start
    while index < end and count < character:
        count += 2 if ord(text[index]) > 0xFFFF else 1
        index += 1
    if count != character:
        raise ValueError("列超出这一行")
    return index


def apply_text_edits(text, edits):
    """把一组 LSP 文本改动应用到文本上；范围重叠或越界都报错，不留半份改动。"""
    spans = []
    for edit in edits:
        rng = edit.get("range") or {}
        start = rng.get("start") or {}
        end = rng.get("end") or {}
        try:
            begin = position_to_index(
                text, int(start.get("line", 0)), int(start.get("character", 0))
            )
            stop = position_to_index(text, int(end.get("line", 0)), int(end.get("character", 0)))
        except (TypeError, ValueError) as exc:
            raise ValueError("改动的行列不对：%s" % exc)
        if stop < begin:
            raise ValueError("改动的范围反了")
        spans.append((begin, stop, str(edit.get("newText") or "")))
    spans.sort(key=lambda item: item[0], reverse=True)
    for index in range(1, len(spans)):
        if spans[index][1] > spans[index - 1][0]:
            raise ValueError("改动的范围重叠了")
    out = text
    for begin, stop, new_text in spans:
        out = out[:begin] + new_text + out[stop:]
    return out


def normalize_workspace_edit(edit, root):
    """WorkspaceEdit 换成 [{path, edits}]；建删改名与工作副本外的改动都不接。"""
    if not isinstance(edit, dict):
        return []
    grouped = {}

    def collect(uri, edits):
        path = uri_to_path(uri)
        if not path or not inside(root, path):
            raise LspUnavailable("重命名的改动落在工作副本外，没处理")
        key = os.path.relpath(path, root).replace(os.sep, "/")
        if isinstance(edits, list):
            grouped.setdefault(key, []).extend(edits)

    changes = edit.get("changes")
    if isinstance(changes, dict):
        for uri, edits in changes.items():
            collect(uri, edits)
    document_changes = edit.get("documentChanges")
    if isinstance(document_changes, list):
        for change in document_changes:
            if not isinstance(change, dict):
                continue
            if change.get("kind"):
                raise LspUnavailable("重命名还要建删或改名文件，这一版不处理")
            doc = change.get("textDocument") or {}
            collect(doc.get("uri"), change.get("edits"))
    return [
        {"path": path, "edits": grouped[path]}
        for path in sorted(grouped)
        if grouped[path]
    ]


def apply_workspace_edit(root, plan):
    """把重命名的改动落到磁盘：先把所有文件算好，再逐个替换，改一半好收场。"""
    prepared = []
    summary = []
    for item in plan:
        full = os.path.join(root, item["path"])
        if not inside(root, full) or not os.path.isfile(full):
            raise LspError("重命名要改的文件不存在：%s" % item["path"])
        try:
            with open(full, "rb") as handle:
                raw = handle.read()
        except OSError as exc:
            raise LspError("读不了 %s：%s" % (item["path"], exc))
        if len(raw) > MAX_EDIT_FILE:
            raise LspError("文件太大，重命名不处理：%s" % item["path"])
        if b"\x00" in raw:
            raise LspError("二进制文件重命名不处理：%s" % item["path"])
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError:
            raise LspError("不是 UTF-8，重命名不处理：%s" % item["path"])
        try:
            updated = apply_text_edits(text, item["edits"])
        except ValueError as exc:
            raise LspError("%s：%s" % (item["path"], exc))
        prepared.append((full, updated.encode("utf-8")))
        summary.append({"path": item["path"], "edits": len(item["edits"])})
    temp_files = []
    try:
        for full, payload in prepared:
            tmp = full + ".dvcsx-rename.tmp"
            with open(tmp, "wb") as handle:
                handle.write(payload)
            temp_files.append((tmp, full))
        for tmp, full in temp_files:
            os.replace(tmp, full)
    finally:
        for tmp, _ in temp_files:
            if os.path.exists(tmp):
                try:
                    os.unlink(tmp)
                except OSError:
                    pass
    return summary


class LspServer:
    """一条 LSP 会话。请求串行由调用方保证，这里只管协议。"""

    def __init__(
        self,
        command,
        root,
        name,
        init_timeout=30.0,
        request_timeout=10.0,
        options=None,
    ):
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
        self.diagnostics = {}
        self.diag_lock = threading.Lock()
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
            if message.get("method") == "textDocument/publishDiagnostics":
                params = message.get("params") or {}
                uri = str(params.get("uri") or "")
                if uri:
                    with self.diag_lock:
                        self.diagnostics[uri] = normalize_diagnostics(params.get("diagnostics") or [])
                continue
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

    def snapshot(self, uri):
        with self.diag_lock:
            return list(self.diagnostics.get(uri) or [])

    def documentsymbol(self, path, text, language):
        self.sync(path, text, language)
        return self.request(
            "textDocument/documentSymbol",
            {"textDocument": {"uri": path_to_uri(path)}},
            timeout=self.request_timeout,
        )

    def rename(self, path, text, language, line, character, new_name):
        self.sync(path, text, language)
        return self.request(
            "textDocument/rename",
            {
                "textDocument": {"uri": path_to_uri(path)},
                "position": {"line": line, "character": character},
                "newName": new_name,
            },
            timeout=self.request_timeout,
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


def stop_instance(item):
    if item.server is not None:
        item.server.stop()
    if item.bridge is not None:
        item.bridge.stop()


class _Instance:
    def __init__(self, ws, key, server, bridge=None):
        self.ws = ws
        self.key = key
        self.server = server
        self.bridge = bridge
        self.last_used = time.time()
        self.lock = threading.Lock()


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

    def diagnostics(self, ws, root, path, text):
        """把文件交给服务器，返回当前攒下的诊断；服务器是异步推的，前端隔一会儿再取。"""
        key = self._ready(path)
        instance = self._instance(ws, key, root)
        full = os.path.join(root, path)
        if SERVERS[key].get("bridge_only"):
            # tsserver 的 geterr 对 .vue 不回话，Vue 这一版先不给诊断。
            return {"server": key, "diagnostics": []}
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
