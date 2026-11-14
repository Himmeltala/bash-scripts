"""文件读写小件：文本与 JSON、原子替换、预览与换行保留。"""

import json
import os
from pathlib import Path


class PreviewError(Exception):
    """预览读不了；kind 是 too_large、binary 或 encoding，调用方换成自己的回话。"""

    def __init__(self, kind, size=0, max_bytes=0, encoding="utf-8"):
        Exception.__init__(self, kind)
        self.kind = kind
        self.size = size
        self.max_bytes = max_bytes
        self.encoding = encoding


def read_text(path, encoding="utf-8", errors=None, default=None):
    """读文本；文件不在、读不了或按这个编码解不开时返回 default。"""
    try:
        if errors is None:
            return Path(path).read_text(encoding=encoding)
        return Path(path).read_text(encoding=encoding, errors=errors)
    except (OSError, UnicodeDecodeError):
        return default


def read_json(path, default=None):
    """读 JSON；文件不在、读不了或不是合法 JSON 时返回 default。"""
    text = read_text(path, default=None)
    if text is None:
        return default
    try:
        return json.loads(text)
    except ValueError:
        return default


def atomic_write_text(path, text, on_error=None, encoding="utf-8"):
    """同目录写临时文件再 os.replace，读者看不到半截内容。

    出错时交给 on_error；没给就继续往上抛。返回是否写成功。
    """
    path = Path(path)
    tmp = path.with_name(path.name + ".tmp")
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(str(tmp), "w", encoding=encoding, newline="") as handle:
            handle.write(text)
        os.replace(str(tmp), str(path))
        return True
    except OSError as exc:
        if on_error is None:
            raise
        on_error(exc)
        return False


def write_json(path, payload, indent=2, ensure_ascii=False, on_error=None):
    """按给定的缩进与转义方式写 JSON，落盘走原子替换。"""
    text = json.dumps(payload, ensure_ascii=ensure_ascii, indent=indent)
    return atomic_write_text(path, text, on_error=on_error)


def read_text_preview(path, max_bytes=512 * 1024, encoding="utf-8"):
    """读一份给页面预览的文本：超过大小上限、含 NUL 或不是 UTF-8 时抛 PreviewError。"""
    path = Path(path)
    size = path.stat().st_size
    if size > max_bytes:
        raise PreviewError("too_large", size=size, max_bytes=max_bytes, encoding=encoding)
    data = path.read_bytes()
    if b"\x00" in data:
        raise PreviewError("binary", size=size, max_bytes=max_bytes, encoding=encoding)
    try:
        return data.decode(encoding)
    except UnicodeDecodeError:
        raise PreviewError("encoding", size=size, max_bytes=max_bytes, encoding=encoding)


def write_text_preserve_newlines(path, text, old=None, encoding="utf-8"):
    """按文本原来的换行风格写回：旧文件用 CRLF 就继续用 CRLF。

    给了 old（旧文件字节）就不再重读；返回写出的字节数。
    """
    if old is None:
        old = Path(path).read_bytes()
    crlf = b"\r\n" in old
    body = text.replace("\r\n", "\n").replace("\r", "\n")
    if crlf:
        body = body.replace("\n", "\r\n")
    raw = body.encode(encoding)
    with open(str(path), "wb") as handle:
        handle.write(raw)
    return len(raw)
