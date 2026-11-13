"""状态行与别名存储：bash 写状态文件，这里只读行、另存别名。"""

import os
import threading
from pathlib import Path

from web import ApiError, log

# bash 写状态行用的字段分隔符。
FS = "\x1f"


class Row:
    """状态行按列名取值。列数不对的行由调用方的 State 丢掉，这里只管取。"""

    __slots__ = ("kind", "f")

    def __init__(self, parts):
        self.kind = parts[0]
        self.f = parts

    def __getitem__(self, idx):
        if isinstance(idx, slice):
            return self.f[idx]
        return self.f[idx] if idx < len(self.f) else ""

    @property
    def id(self):
        return self[1]

    @property
    def ws(self):
        return self[2]


class AliasStore:
    """工作区别名，存在状态文件旁边；状态文件本身仍由 bash 写，这里不碰它。"""

    def __init__(self, path):
        self.path = Path(path)
        self._lock = threading.Lock()

    def _load(self):
        out = {}
        try:
            text = self.path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            return out
        for line in text.splitlines():
            if not line:
                continue
            ws, sep, alias = line.partition(FS)
            if sep and ws and alias:
                out[ws] = alias
        return out

    def _save(self, data):
        tmp = self.path.with_name(self.path.name + ".tmp")
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            text = "".join(ws + FS + alias + "\n" for ws, alias in data.items() if ws and alias)
            tmp.write_text(text, encoding="utf-8")
            os.replace(tmp, self.path)
        except OSError as exc:
            log("写别名失败 %s：%s" % (self.path, exc))

    def all(self):
        with self._lock:
            return self._load()

    def set(self, ws, alias):
        alias = " ".join((alias or "").split()).replace(FS, " ")
        if len(alias) > 80:
            raise ApiError(400, "别名太长，最多 80 个字")
        with self._lock:
            data = self._load()
            if alias:
                data[ws] = alias
            else:
                data.pop(ws, None)
            self._save(data)
