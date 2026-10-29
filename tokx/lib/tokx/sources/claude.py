"""Claude Code：扫 ~/.claude/projects 下的会话 JSONL。"""

from __future__ import annotations

import json
from pathlib import Path

from ..model import Record, Usage
from . import parse_timestamp


def collect(root: Path) -> list[Record]:
    projects = root / "projects"
    if not projects.is_dir():
        return []

    # 同一条回复按内容块分行写入，usage 逐行累加，只留 token 总数最大的那行。
    merged: dict[tuple[str, str], Record] = {}
    unique = 0
    for path in sorted(projects.rglob("*.jsonl")):
        try:
            handle = path.open("r", encoding="utf-8", errors="replace")
        except OSError:
            continue
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
                    key = (record.session, str(ident))
                else:
                    unique += 1
                    key = (record.session, f"anonymous-{unique}")
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
