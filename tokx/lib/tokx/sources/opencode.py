"""opencode：优先读 SQLite，旧版本回退到 storage/message 下的 JSON。"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from ..model import Record, Usage
from . import parse_epoch_ms


def collect(root: Path) -> list[Record]:
    database = root / "opencode.db"
    if database.is_file():
        return _from_db(database)
    return _from_storage(root / "storage" / "message")


def _from_db(database: Path) -> list[Record]:
    try:
        con = sqlite3.connect(f"file:{database}?mode=ro", uri=True)
    except sqlite3.Error as exc:
        raise OSError(f"打不开 {database}: {exc}") from exc
    try:
        con.row_factory = sqlite3.Row
        try:
            rows = con.execute(
                "select m.session_id, m.time_created, m.data, s.directory"
                " from message m left join session s on s.id = m.session_id"
            ).fetchall()
        except sqlite3.Error:
            rows = [
                dict(row, directory="")
                for row in con.execute(
                    "select session_id, time_created, data from message"
                ).fetchall()
            ]
    except sqlite3.Error as exc:
        raise OSError(f"读 {database} 失败: {exc}") from exc
    finally:
        con.close()

    records: list[Record] = []
    for row in rows:
        record = _record(
            data=_loads(row["data"]),
            session=str(row["session_id"]),
            fallback_ms=row["time_created"],
            project=str(row["directory"] or ""),
        )
        if record is not None:
            records.append(record)
    return records


def _from_storage(root: Path) -> list[Record]:
    if not root.is_dir():
        return []
    records: list[Record] = []
    for path in sorted(root.glob("*/*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        record = _record(data=data, session=path.parent.name, fallback_ms=None, project="")
        if record is not None:
            records.append(record)
    return records


def _record(data: dict, session: str, fallback_ms: object, project: str) -> Record | None:
    if data.get("role") != "assistant":
        return None
    tokens = data.get("tokens")
    if not isinstance(tokens, dict):
        return None
    cache = tokens.get("cache") if isinstance(tokens.get("cache"), dict) else {}
    usage = Usage(
        input=_count(tokens.get("input")),
        cache_read=_count(cache.get("read")),
        cache_write=_count(cache.get("write")),
        output=_count(tokens.get("output")),
        reasoning=_count(tokens.get("reasoning")),
    )
    if usage.total == 0:
        return None
    time_info = data.get("time")
    at = parse_epoch_ms(time_info.get("created") if isinstance(time_info, dict) else None)
    if at is None:
        at = parse_epoch_ms(fallback_ms)
    if at is None:
        return None
    return Record(
        source="opencode",
        session=session,
        at=at,
        model=str(data.get("modelID") or ""),
        provider=str(data.get("providerID") or ""),
        project=project,
        usage=usage,
    )


def _loads(raw: object) -> dict:
    if not isinstance(raw, str):
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _count(value: object) -> int:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return 0
    return max(int(value), 0)
