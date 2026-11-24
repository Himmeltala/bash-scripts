"""页面日志的持久化存储：追加写 JSON 行，按页读最新的若干条。"""

import json
import threading
import time
from pathlib import Path

LEVELS = ("error", "warning", "info")
DETAIL_MAX = 16000
MESSAGE_MAX = 4000
# 文件只留最近这些条，避免长期运行无限增长。
MAX_ENTRIES = 5000


class LogStore:
    """线程安全的日志文件：内部保存全部已加载条目，读时按 id 倒序分页。"""

    def __init__(self, path, max_entries=MAX_ENTRIES):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.max_entries = max_entries
        self._lock = threading.Lock()
        self._items = []
        self._seq = 0
        self._load()

    def _load(self):
        try:
            lines = self.path.read_text(encoding="utf-8").splitlines()
        except OSError:
            return
        for line in lines:
            try:
                item = json.loads(line)
            except ValueError:
                continue
            if isinstance(item, dict) and isinstance(item.get("id"), int):
                self._items.append(item)
                self._seq = max(self._seq, item["id"])
        self._items.sort(key=lambda item: item["id"])

    def _rewrite(self):
        data = "".join(json.dumps(item, ensure_ascii=False) + "\n" for item in self._items)
        tmp = self.path.with_name(self.path.name + ".tmp")
        tmp.write_text(data, encoding="utf-8")
        tmp.replace(self.path)

    def add(self, level, message, detail="", source="server"):
        text = " ".join(str(message or "").split())
        if not text:
            return None
        level = level if level in LEVELS else "info"
        with self._lock:
            self._seq += 1
            item = {
                "id": self._seq,
                "at": int(time.time() * 1000),
                "level": level,
                "source": str(source or "server")[:40],
                "message": text[:MESSAGE_MAX],
                "detail": str(detail or "")[:DETAIL_MAX],
            }
            self._items.append(item)
            if len(self._items) > self.max_entries:
                self._items = self._items[-self.max_entries :]
                self._rewrite()
            else:
                try:
                    with self.path.open("a", encoding="utf-8") as fh:
                        fh.write(json.dumps(item, ensure_ascii=False) + "\n")
                except OSError:
                    pass
            return item

    def read(self, before=None, limit=200, level=None):
        try:
            limit = max(1, min(int(limit), 500))
        except (TypeError, ValueError):
            limit = 200
        try:
            before = int(before) if before not in (None, "") else None
        except (TypeError, ValueError):
            before = None
        with self._lock:
            items = self._items
            if level in LEVELS:
                items = [item for item in items if item.get("level") == level]
            if before is not None:
                items = [item for item in items if item["id"] < before]
            items = items[::-1]
            page = items[:limit]
            counts = {"error": 0, "warning": 0, "info": 0}
            for item in self._items:
                key = item.get("level")
                if key in counts:
                    counts[key] += 1
            return {
                "items": page,
                "total": len(self._items),
                "counts": counts,
                "has_more": len(items) > limit,
                "next_before": page[-1]["id"] if page else None,
            }

    def clear(self):
        with self._lock:
            self._items = []
            self._rewrite()
