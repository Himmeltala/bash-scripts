"""Claude Code：扫 ~/.claude/projects 下的会话 JSONL。"""

from __future__ import annotations

import json
from pathlib import Path

from ..model import Record, Usage
from ..snapshot import Snapshot
from . import parse_timestamp

# 按会话汇总的缓存条目没有对应文件，给一个不会撞上文件路径的标识。
_MERGE = {"size": 0, "mtime": 0}


def collect(root: Path, snapshot: Snapshot | None = None) -> list[Record]:
    """扫会话文件；给了 snapshot 就按文件缓存，没改过的文件直接复用上次结果。"""
    projects = root / "projects"
    if not projects.is_dir():
        return []

    # 先按文件解析，再按 (会话, 去重键) 合并：子代理文件与被引用的会话可能出现在多个文件里。
    per_file: dict[str, list[Record]] = {}
    seen: set[str] = set()
    for path in sorted(projects.rglob("*.jsonl")):
        ident = str(path)
        seen.add(ident)
        signature = snapshot.signature(path) if snapshot is not None else {}
        cached = snapshot.cached(ident, signature) if snapshot is not None else None
        if cached is not None:
            per_file[ident] = cached
            continue
        parsed = _file(path)
        per_file[ident] = parsed
        # 读不了的文件不留缓存，下次再试。
        if snapshot is not None and signature:
            snapshot.remember(ident, signature, parsed)

    if snapshot is not None:
        snapshot.prune(seen)

    # 缓存按文件存，文件删了条目跟着没了；这里再按会话凑一遍，被删文件的会话才认得出是整条没了。
    by_session: dict[str, list[Record]] = {}
    for records in per_file.values():
        for record in records:
            by_session.setdefault(record.session, []).append(record)
    if snapshot is not None:
        for session, records in by_session.items():
            snapshot.remember(session, _MERGE, records)

    merged: dict[tuple[str, str], Record] = {}
    for records in per_file.values():
        _merge(merged, records)
    return list(merged.values())


def _merge(merged: dict[tuple[str, str], Record], records: list[Record]) -> None:
    # 同一条回复按内容块分行写入，usage 逐行累加，跨文件也只留 token 总数最大的那行。
    for record in records:
        key = (record.session, record.key)
        previous = merged.get(key)
        if previous is None or record.usage.total > previous.usage.total:
            merged[key] = record


def _file(path: Path) -> list[Record]:
    """一个会话文件里的回复，同一 message.id 取 token 最多的那行。"""
    merged: dict[tuple[str, str], Record] = {}
    unique = 0
    try:
        handle = path.open("r", encoding="utf-8", errors="replace")
    except OSError:
        return []
    with handle:
        for line in handle:
            if '"usage"' not in line:
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue
            record = _record(entry, path)
            if record is None:
                continue
            message = entry.get("message") or {}
            ident = message.get("id") or entry.get("uuid")
            if ident:
                record.key = str(ident)
            else:
                unique += 1
                record.key = f"anonymous-{unique}"
            key = (record.session, record.key)
            previous = merged.get(key)
            if previous is None or record.usage.total > previous.usage.total:
                merged[key] = record
    return list(merged.values())


def _record(entry: dict, path: Path) -> Record | None:
    if entry.get("type") != "assistant":
        return None
    message = entry.get("message")
    if not isinstance(message, dict):
        return None
    usage = message.get("usage")
    if not isinstance(usage, dict):
        return None
    model = message.get("model")
    if not isinstance(model, str) or not model or model.startswith("<"):
        return None
    at = parse_timestamp(entry.get("timestamp"))
    if at is None:
        return None

    # 会话 ID 取 sessionId，个别行没有时退回文件名，不能存成文件的绝对路径。
    session = entry.get("sessionId") or path.stem
    record = Record(
        source="claude",
        session=str(session),
        at=at,
        model=model,
        provider="anthropic",
        project=str(entry.get("cwd") or ""),
        usage=Usage(
            input=_count(usage.get("input_tokens")),
            cache_read=_count(usage.get("cache_read_input_tokens")),
            cache_write=_count(usage.get("cache_creation_input_tokens")),
            output=_count(usage.get("output_tokens")),
        ),
    )
    if record.usage.total == 0:
        return None
    return record


def _count(value: object) -> int:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return 0
    return max(int(value), 0)
