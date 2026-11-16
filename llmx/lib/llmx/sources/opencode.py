"""opencode：优先读 SQLite，旧版本回退到 storage/message 下的 JSON。"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from ..model import Record, Usage
from ..snapshot import Snapshot
from . import parse_epoch_ms


def collect(root: Path, snapshot: Snapshot | None = None) -> list[Record]:
    """优先读库；库里什么都读不出来时才退回 storage/message 下的 JSON。"""
    database = root / "opencode.db"
    if database.is_file():
        records = _from_db(database, snapshot)
        if records:
            return records
    return _from_storage(root / "storage" / "message", snapshot)


def _from_db(database: Path, snapshot: Snapshot | None = None) -> list[Record]:
    # 库文件没变就直接用上次的解析结果；库照常读一遍确认它还在，库没了缓存跟着作废。
    ident = str(database)
    signature = snapshot.signature(database) if snapshot is not None else {}
    cached = snapshot.cached(ident, signature) if snapshot is not None else None
    if cached is not None:
        return cached

    try:
        con = sqlite3.connect(f"file:{database}?mode=ro", uri=True)
    except sqlite3.Error as exc:
        raise OSError(f"打不开 {database}: {exc}") from exc
    try:
        con.row_factory = sqlite3.Row
        try:
            rows = con.execute(
                "select m.id, m.session_id, m.time_created, m.data, s.directory"
                " from message m left join session s on s.id = m.session_id"
            ).fetchall()
        except sqlite3.Error:
            rows = [
                {"id": row[0], "session_id": row[1], "time_created": row[2],
                 "data": row[3], "directory": ""}
                for row in con.execute(
                    "select id, session_id, time_created, data from message"
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
            key=f"db:{row['id']}",
        )
        if record is not None:
            records.append(record)
    if snapshot is not None and signature:
        snapshot.remember(ident, signature, records, [])
    return records


def _from_storage(root: Path, snapshot: Snapshot | None = None) -> list[Record]:
    if not root.is_dir():
        return []
    records: list[Record] = []
    seen: set[str] = set()
    for path in sorted(root.glob("*/*.json")):
        ident = str(path)
        seen.add(ident)
        signature = snapshot.signature(path) if snapshot is not None else {}
        cached = snapshot.cached(ident, signature) if snapshot is not None else None
        if cached is not None:
            records.extend(cached)
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        parsed = _record(data=data, session=path.parent.name, fallback_ms=None, project="")
        if parsed is None:
            continue
        parsed.key = ident
        if snapshot is not None:
            snapshot.remember(ident, signature, [parsed])
        records.append(parsed)
    if snapshot is not None:
        snapshot.prune(seen)
    return records


def _record(
    data: dict,
    session: str,
    fallback_ms: object,
    project: str,
    key: str = "",
) -> Record | None:
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
        key=key,
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
