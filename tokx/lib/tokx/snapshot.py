"""现扫缓存：会话文件没变就跳过重复解压，变了才重新解析。

缓存只是加速层，丢了重扫一遍即可，不进账本；账本见 store.py。条目键要么是会话 id，
要么是文件路径（Claude 与 opencode 的回退路径按文件缓存），值里带文件标识与解析好的记录。
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

from .model import Record, Usage

FORMAT = 2

# session.v4.jsonl.zstd、session.jsonl 都认，只取版本号最大的那一代。
_DSH_FILE = re.compile(r"^session(?:\.v(?P<version>\d+))?\.jsonl(?:\.[A-Za-z0-9]+)?$")


class Snapshot:
    """一个来源的现扫结果快照：{"size", "mtime", "files"?, "records"}；还原时按记录里的会话 id，不拿缓存键充当会话。"""

    def __init__(self, source: str, path: Path | None) -> None:
        self.source = source
        self.path = path
        self.data: dict[str, dict] = {}
        self.dirty = False
        self._load()

    def _load(self) -> None:
        if self.path is None or not self.path.is_file():
            return
        try:
            doc = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return
        if not isinstance(doc, dict) or doc.get("format") != FORMAT:
            return
        sessions = doc.get("sessions")
        if isinstance(sessions, dict):
            self.data = {
                str(name): entry
                for name, entry in sessions.items()
                if isinstance(entry, dict)
            }

    def signature(self, path: Path) -> dict:
        """文件的大小与修改时间，任一变了就作废。"""
        try:
            stat = path.stat()
        except OSError:
            return {}
        return {"size": stat.st_size, "mtime": stat.st_mtime}

    def cached(
        self,
        session: str,
        signature: dict,
        file_names: list[str] | None = None,
    ) -> list[Record] | None:
        """缓存条目对应的文件没变时返回上次解析的结果，否则返回 None 让调用方重扫。"""
        if not signature:
            return None
        entry = self.data.get(session)
        if entry is None:
            return None
        if entry.get("size") != signature.get("size"):
            return None
        if entry.get("mtime") != signature.get("mtime"):
            return None
        if file_names is not None and sorted(entry.get("files") or []) != sorted(file_names):
            return None
        return self.records(session)

    def records(self, session: str) -> list[Record] | None:
        """不校验文件标识，直接取该条目上次解析的结果。"""
        entry = self.data.get(session)
        if entry is None:
            return None
        try:
            return [_record(self.source, item) for item in entry.get("records") or []]
        except (TypeError, ValueError, IndexError):
            return None

    def remember(
        self,
        session: str,
        signature: dict,
        records: list[Record],
        files: list[str] | None = None,
    ) -> None:
        entry: dict = {
            "size": signature.get("size"),
            "mtime": signature.get("mtime"),
            "records": [_encode(record) for record in records],
        }
        if files is not None:
            entry["files"] = list(files)
        if self.data.get(session) != entry:
            self.data[session] = entry
            self.dirty = True

    def prune(self, alive: set[str]) -> None:
        """文件或会话已经不在了，把对应的缓存条目摘掉。"""
        for name in [name for name in self.data if name not in alive]:
            del self.data[name]
            self.dirty = True

    def save(self) -> None:
        if not self.dirty or self.path is None:
            return
        doc = {"format": FORMAT, "source": self.source, "sessions": self.data}
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            tmp = self.path.with_name(self.path.name + ".tmp")
            tmp.write_text(json.dumps(doc, ensure_ascii=False), encoding="utf-8")
            tmp.replace(self.path)
            self.dirty = False
        except OSError:
            # 缓存写不进去只影响下次的速度，不影响数字，安静放弃。
            return


def dsh_generations(root: Path) -> dict[str, tuple[Path, list[str]]]:
    """每个会话取最高版本那一代日志，返回 {会话: (要解析的文件, 这一代全部文件名)}；上一代可能还在，只读最高代不重复计数。"""
    groups: dict[str, dict[int, list[Path]]] = {}
    for path in root.rglob("session*.jsonl*"):
        match = _DSH_FILE.match(path.name)
        if match is None or not path.is_file():
            continue
        version = int(match.group("version") or 0)
        groups.setdefault(path.parent.name, {}).setdefault(version, []).append(path)

    result: dict[str, tuple[Path, list[str]]] = {}
    for session, by_version in groups.items():
        newest = by_version[max(by_version)]
        paths = sorted(newest)
        # 一个世代的日志可能是没压缩的整份，也可能是压缩分片，优先读整份。
        whole = [path for path in paths if ".jsonl." not in path.name]
        result[session] = ((whole or paths)[0], sorted(path.name for path in paths))
    return result


def _encode(record: Record) -> list:
    """缓存里的一行，会话 id 放第一位。"""
    usage = record.usage
    return [
        record.session,
        int(record.at.timestamp() * 1000),
        record.model,
        record.provider,
        record.project,
        record.key,
        usage.input,
        usage.cache_read,
        usage.cache_write,
        usage.output,
        usage.reasoning,
    ]


def _record(source: str, item: list) -> Record:
    """把缓存里的一行还原成记录。"""
    return Record(
        source=str(source),
        session=str(item[0]),
        at=datetime.fromtimestamp(int(item[1]) / 1000, tz=timezone.utc),
        model=str(item[2]),
        provider=str(item[3]),
        project=str(item[4]),
        key=str(item[5]),
        usage=Usage(
            input=int(item[6]),
            cache_read=int(item[7]),
            cache_write=int(item[8]),
            output=int(item[9]),
            reasoning=int(item[10]),
        ),
    )
