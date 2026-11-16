"""Claude Code 会话：按文件列出、关联账本用量、移进回收目录。

会话文件按目录结构归组：projects/<项目>/<会话>.jsonl 与
projects/<项目>/<会话>/**/*.jsonl 都算同一个会话。删除只移动文件，账本里的记录
按既有设计保留，只有 llmx db gc 才清陈旧会话。
"""

from __future__ import annotations

import os
import time
from pathlib import Path

from .config import Config
from .report import _project_name
from .store import Store


class SessionError(Exception):
    """会话读写失败，消息直接给页面。"""


def projects_dir(config: Config) -> Path:
    return config.paths.claude / "projects"


def garbage_dir(config: Config) -> Path:
    return config.paths.garbage / "claude"


def _text_time(value: object, config: Config) -> str:
    if not value:
        return ""
    return value.astimezone(config.book.tz).strftime("%Y-%m-%d %H:%M")


def _scan(config: Config) -> dict[str, dict]:
    """只读目录元数据，不解析文件内容；返回按会话归并的文件清单。"""
    root = projects_dir(config)
    found: dict[str, dict] = {}
    if not root.is_dir():
        return found
    try:
        paths = list(root.rglob("*.jsonl"))
    except OSError:
        return found
    for path in paths:
        try:
            stat = path.stat()
        except OSError:
            continue
        parts = path.relative_to(root).parts
        if len(parts) < 2:
            continue
        project = parts[0]
        session = Path(parts[1]).stem if len(parts) == 2 else parts[1]
        item = found.setdefault(
            session,
            {"id": session, "project": project, "files": [], "size": 0, "updated": 0.0},
        )
        item["files"].append(str(path))
        item["size"] += stat.st_size
        item["updated"] = max(item["updated"], stat.st_mtime)
    return found


def _blank_totals(record) -> dict:
    return {
        "requests": 0,
        "input": 0,
        "cache_read": 0,
        "cache_write": 0,
        "output": 0,
        "reasoning": 0,
        "cost": 0.0,
        "started": record.at,
        "ended": record.at,
        "project_path": record.project,
        "models": set(),
        "unpriced": set(),
    }


def _add(total: dict, record, book) -> None:
    total["requests"] += 1
    total["input"] += record.usage.input
    total["cache_read"] += record.usage.cache_read
    total["cache_write"] += record.usage.cache_write
    total["output"] += record.usage.output
    total["reasoning"] += record.usage.reasoning
    total["started"] = min(total["started"], record.at)
    total["ended"] = max(total["ended"], record.at)
    if record.project:
        total["project_path"] = record.project
    model = book.resolve(record.model) or record.model
    total["models"].add(model)
    price = book.cost(record.model, record.usage, record.at)
    if price is None:
        total["unpriced"].add(model)
    else:
        total["cost"] += price


def _aggregate(config: Config, wanted: set[str] | None = None) -> tuple[dict, dict]:
    """一次读账本，返回 (按会话合计, 按会话与模型接口拆开的明细)。"""
    if not config.store.enabled:
        return {}, {}
    with Store(config.store.db, config.book.tz) as store:
        records = store.records(["claude"])

    totals: dict[str, dict] = {}
    rows: dict[str, dict] = {}
    for record in records:
        if wanted is not None and record.session not in wanted:
            continue
        _add(totals.setdefault(record.session, _blank_totals(record)), record, config.book)
        model = config.book.resolve(record.model) or record.model
        row = rows.setdefault(record.session, {}).setdefault(
            f"{model}\u0000{record.api}",
            {
                "model": model,
                "api": record.api,
                "requests": 0,
                "input": 0,
                "cache_read": 0,
                "cache_write": 0,
                "output": 0,
                "total_tokens": 0,
                "cost": 0.0,
            },
        )
        row["requests"] += 1
        row["input"] += record.usage.input
        row["cache_read"] += record.usage.cache_read
        row["cache_write"] += record.usage.cache_write
        row["output"] += record.usage.output
        row["total_tokens"] += record.usage.total
        price = config.book.cost(record.model, record.usage, record.at)
        if price is not None:
            row["cost"] += price
    return totals, rows


def _project(item: dict, total: dict | None) -> dict:
    path = (total or {}).get("project_path", "")
    return {
        "project": _project_name(path) if path else item["project"],
        "project_path": path,
    }


def _summary(item: dict, total: dict | None, config: Config) -> dict:
    found = total or {}
    return {
        "id": item["id"],
        **_project(item, total),
        "files": list(item["files"]),
        "size": item["size"],
        "updated": time.strftime("%Y-%m-%d %H:%M", time.localtime(item["updated"]))
        if item["updated"]
        else "",
        "started": _text_time(found.get("started"), config),
        "ended": _text_time(found.get("ended"), config),
        "requests": found.get("requests", 0),
        "input": found.get("input", 0),
        "cache_read": found.get("cache_read", 0),
        "cache_write": found.get("cache_write", 0),
        "output": found.get("output", 0),
        "total_tokens": found.get("input", 0)
        + found.get("cache_read", 0)
        + found.get("cache_write", 0)
        + found.get("output", 0),
        "cost": found.get("cost"),
        "models": sorted(found.get("models", ())),
        "unpriced_models": sorted(found.get("unpriced", ())),
    }


def list_sessions(config: Config) -> dict:
    files = _scan(config)
    totals, _ = _aggregate(config, set(files))
    rows = [_summary(item, totals.get(session), config) for session, item in files.items()]
    rows.sort(key=lambda row: (row["updated"], row["id"]), reverse=True)
    return {
        "dir": str(projects_dir(config)),
        "garbage": str(garbage_dir(config)),
        "sessions": rows,
    }


def detail(config: Config, session_id: object) -> dict:
    if not isinstance(session_id, str) or not session_id:
        raise SessionError("会话 id 要是文本")
    item = _scan(config).get(session_id)
    if item is None:
        raise SessionError(f"没有会话 {session_id}")

    totals, rows = _aggregate(config, {session_id})
    summary = _summary(item, totals.get(session_id), config)
    summary["rows"] = sorted(
        rows.get(session_id, {}).values(),
        key=lambda row: (-row["total_tokens"], row["model"], row["api"]),
    )
    return summary


def _inside(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


def trash(config: Config, ids: object) -> dict:
    """把选中的会话文件移进回收目录；移不动就报错，原文件留在原处。"""
    if not isinstance(ids, list) or not ids:
        raise SessionError("没有选会话")
    files = _scan(config)
    root = projects_dir(config).resolve()
    target_dir = garbage_dir(config)
    try:
        target_dir.mkdir(parents=True, exist_ok=True)
        os.chmod(target_dir, 0o700)
    except OSError as exc:
        raise SessionError(f"建不了回收目录 {target_dir}: {exc}") from exc

    stamp = time.strftime("%Y%m%d-%H%M%S")
    moved = []
    for session_id in ids:
        if not isinstance(session_id, str):
            continue
        item = files.get(session_id)
        # 文件已经不在就当没选过它，不当错误。
        if item is None:
            continue
        for text in item["files"]:
            path = Path(text).resolve()
            if not _inside(path, root) or path.suffix != ".jsonl":
                raise SessionError(f"拒绝移动会话目录之外的文件 {path}")
            target = target_dir / f"{path.stem}-{stamp}{path.suffix}"
            index = 1
            while target.exists():
                target = target_dir / f"{path.stem}-{stamp}-{index}{path.suffix}"
                index += 1
            try:
                path.rename(target)
            except OSError as exc:
                raise SessionError(f"移动 {path} 失败：{exc}") from exc
            moved.append({"from": str(path), "to": str(target)})
    return {"moved": len(moved), "files": moved, "garbage": str(target_dir)}
