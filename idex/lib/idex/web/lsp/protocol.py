"""LSP 的帧与结果换算：Content-Length 帧、URI、位置、诊断、符号与文本编辑。

纯协议层，不拉进程；会话与管理器在这里拿编解码和归一化函数。
"""

import json
import os
from urllib.parse import quote, unquote, urlparse

# 结果最多回这么多条，够页面列候选了。
MAX_LOCATIONS = 20


class LspError(Exception):
    """LSP 会话出错：超时、服务器退出、回话里带 error。"""


class LspUnavailable(LspError):
    """这种文件没有对应的语言服务器，或者服务器没装。"""


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


def lsp_hover_text(raw):
    """LSP hover 的 contents（MarkedString / MarkupContent / 数组）换成一段纯文本。"""
    if not isinstance(raw, dict):
        return ""
    contents = raw.get("contents")

    def part(value):
        if isinstance(value, str):
            return value
        if isinstance(value, dict):
            return str(value.get("value") or "")
        return ""

    if isinstance(contents, list):
        parts = [part(item) for item in contents]
    else:
        parts = [part(contents)]
    return "\n\n".join(item for item in parts if item)[:4000]


def tsserver_hover_text(raw):
    if not isinstance(raw, dict):
        return ""
    parts = [str(raw.get("displayString") or ""), str(raw.get("documentation") or "")]
    return "\n\n".join(item for item in parts if item)[:4000]


def tsserver_diagnostics(items):
    """tsserver 的 Diagnostic[] 换成与 LSP 相同形状。"""
    out = []
    for item in items or []:
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
        out.append(
            {
                "severity": level,
                "line": max(0, line),
                "character": max(0, character),
                "message": message[:500],
                "source": "",
            }
        )
        if len(out) >= 200:
            break
    return out


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
            tmp = full + ".idex-rename.tmp"
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


COMPLETION_KINDS = {
    1: "text",
    2: "method",
    3: "function",
    4: "constructor",
    5: "field",
    6: "variable",
    7: "class",
    8: "interface",
    9: "module",
    10: "property",
    11: "unit",
    12: "value",
    13: "enum",
    14: "keyword",
    15: "snippet",
    16: "color",
    17: "file",
    18: "reference",
    19: "folder",
    20: "enumMember",
    21: "constant",
    22: "struct",
    23: "event",
    24: "operator",
    25: "typeParameter",
}


def _position(value):
    if not isinstance(value, dict):
        return None
    line = value.get("line")
    character = value.get("character")
    if isinstance(line, bool) or isinstance(character, bool):
        return None
    if not isinstance(line, int) or not isinstance(character, int):
        return None
    if line < 0 or character < 0:
        return None
    return {"line": line, "character": character}


def _text(value):
    return value if isinstance(value, str) else ""


def _documentation(value):
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        return _text(value.get("value"))
    return ""


def _text_edit(value):
    if not isinstance(value, dict):
        return None
    range_ = value.get("range")
    if not isinstance(range_, dict):
        return None
    start = _position(range_.get("start"))
    end = _position(range_.get("end"))
    new_text = value.get("newText")
    if start is None or end is None or not isinstance(new_text, str):
        return None
    return {"start": start, "end": end, "newText": new_text}


def normalize_completions(raw):
    """LSP 的补全结果：接受数组或 CompletionList，最多 200 条。"""
    if isinstance(raw, dict):
        items = raw.get("items")
        incomplete = bool(raw.get("isIncomplete"))
    else:
        items = raw
        incomplete = False
    if not isinstance(items, list):
        items = []
    out = []
    for item in items:
        if not isinstance(item, dict):
            continue
        label = item.get("label")
        if not isinstance(label, str) or not label:
            continue
        if item.get("additionalTextEdits"):
            continue
        kind = item.get("kind")
        out.append(
            {
                "label": label,
                "kind": COMPLETION_KINDS.get(kind, "") if isinstance(kind, int) else "",
                "detail": _text(item.get("detail")),
                "documentation": _documentation(item.get("documentation")),
                "insertText": _text(item.get("insertText")),
                "filterText": _text(item.get("filterText")),
                "sortText": _text(item.get("sortText")),
                "textEdit": _text_edit(item.get("textEdit")),
            }
        )
        if len(out) >= 200:
            break
    return {"items": out, "incomplete": incomplete}


def normalize_format_edits(raw):
    """整份格式化的 TextEdit 列表，丢掉缺字段与负行列的条目。"""
    if not isinstance(raw, list):
        return []
    out = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        range_ = item.get("range")
        if not isinstance(range_, dict):
            continue
        start = _position(range_.get("start"))
        end = _position(range_.get("end"))
        new_text = item.get("newText")
        if start is None or end is None or not isinstance(new_text, str):
            continue
        out.append({"start": start, "end": end, "newText": new_text})
    return out
