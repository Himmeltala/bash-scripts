"""行式键值文件：一行一条，字段用 FS 分隔，读写都加锁、落盘用原子替换。"""

import threading
from pathlib import Path

from fileio import atomic_write_text

# bash 写状态行用的字段分隔符。
FS = "\x1f"


class LineStore:
    """一个文件一张表；normalize、validate、decode 三个钩子留给子类。"""

    separator = FS

    def __init__(self, path, allow_empty=False, on_error=None):
        self.path = Path(path)
        self.allow_empty = allow_empty
        self.on_error = on_error
        self._lock = threading.Lock()

    def normalize(self, value):
        """存之前把值整成想要的形状；子类覆写。"""
        return value

    def validate(self, key, value):
        """存之前校验；不合格就抛异常，子类覆写。"""

    def decode(self, key, value):
        """读出来时还原值；子类覆写。"""
        return value

    def _load(self):
        out = {}
        try:
            text = self.path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            return out
        for line in text.splitlines():
            if not line:
                continue
            key, sep, value = line.partition(self.separator)
            if not sep or not key:
                continue
            if not value and not self.allow_empty:
                continue
            out[key] = value
        return out

    def _save(self, data):
        lines = []
        for key, value in data.items():
            if not key:
                continue
            if not value and not self.allow_empty:
                continue
            lines.append(key + self.separator + value + "\n")
        return atomic_write_text(self.path, "".join(lines), on_error=self.on_error)

    def all(self):
        with self._lock:
            data = self._load()
        return dict((key, self.decode(key, value)) for key, value in data.items())

    def get(self, key, default=None):
        with self._lock:
            data = self._load()
        if key not in data:
            return default
        return self.decode(key, data[key])

    def set(self, key, value):
        value = self.normalize(value)
        self.validate(key, value)
        with self._lock:
            data = self._load()
            if value or self.allow_empty:
                data[key] = value
            else:
                data.pop(key, None)
            self._save(data)

    def remove(self, key):
        with self._lock:
            data = self._load()
            data.pop(key, None)
            self._save(data)
