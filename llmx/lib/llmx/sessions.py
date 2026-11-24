"""Claude Code 会话：按文件列出、关联账本用量、移进回收目录。

会话文件按目录结构归组：projects/<项目>/<会话>.jsonl 与
projects/<项目>/<会话>/**/*.jsonl 都算同一个会话。删除只移动文件，账本里的记录
按既有设计保留，只有 llmx db gc 才清陈旧会话。
"""

from __future__ import annotations

import os
import time
from datetime import datetime
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


def _garbage_groups(config: Config) -> dict[str, dict]:
    """回收目录按「批次/项目/会话」归组。

    新布局是 ``<时间戳>/<项目>/<会话>.jsonl``，子代理文件在 ``<会话>/`` 下，原相对路径还在；
    旧版本平铺成 ``<名字>-<时间戳>.jsonl``，原路径丢了，只能彻底删除，不能撤回。
    """
    root = garbage_dir(config)
    groups: dict[str, dict] = {}
    try:
        paths = list(root.rglob("*.jsonl")) if root.is_dir() else []
    except OSError:
        paths = []
    for path in paths:
        try:
            stat = path.stat()
            rel = path.relative_to(root)
        except (OSError, ValueError):
            continue
        parts = rel.parts
        if len(parts) >= 3:
            session = parts[2] if len(parts) > 3 else Path(parts[2]).stem
            key = "/".join((parts[0], parts[1], session))
            restore_parts: tuple[str, ...] = parts[1:]
            restorable = True
            name, project = session, parts[1]
        else:
            # 旧布局没记原路径，不猜。
            key = rel.as_posix()
            restore_parts = ()
            restorable = False
            name, project = rel.name, ""
        item = groups.setdefault(
            key,
            {
                "id": key,
                "name": name,
                "project": project,
                "files": [],
                "restore": [],
                "size": 0,
                "updated": 0.0,
                "restorable": restorable,
            },
        )
        item["files"].append(path)
        item["restore"].append(restore_parts)
        item["size"] += stat.st_size
        item["updated"] = max(item["updated"], stat.st_mtime)
    return groups


def garbage_list(config: Config) -> dict:
    root = garbage_dir(config)
    rows = []
    for group in _garbage_groups(config).values():
        rows.append(
            {
                "id": group["id"],
                "name": group["name"],
                "project": group["project"],
                "files": len(group["files"]),
                "size": group["size"],
                "moved": datetime.fromtimestamp(group["updated"], config.book.tz).strftime(
                    "%Y-%m-%d %H:%M"
                ),
                "restorable": group["restorable"],
            }
        )
    rows.sort(key=lambda row: (row["moved"], row["id"]), reverse=True)
    return {"dir": str(root), "files": rows}


def _wanted_ids(ids: object, what: str) -> list[str]:
    if not isinstance(ids, list) or not ids:
        raise SessionError(f"没有选{what}")
    return [item for item in ids if isinstance(item, str) and item]


def garbage_restore(config: Config, ids: object) -> dict:
    """把回收目录里的会话搬回原来的项目目录；目标已存在就整批不动，绝不覆盖。"""
    wanted = _wanted_ids(ids, "要撤回的会话")
    groups = _garbage_groups(config)
    root = projects_dir(config)
    plan = []
    for key in wanted:
        group = groups.get(key)
        if group is None:
            continue
        if not group["restorable"]:
            raise SessionError(f"「{group['name']}」是旧版本移入的，原路径已丢失，不能撤回")
        for path, parts in zip(group["files"], group["restore"]):
            target = root.joinpath(*parts)
            try:
                target.resolve().relative_to(root.resolve())
            except ValueError as exc:
                raise SessionError(f"拒绝还原到项目目录之外 {target}") from exc
            if target.exists():
                raise SessionError(f"原位置已有文件 {target}，没撤回；先处理同名文件再试")
            plan.append((path, target))
    if not plan:
        return {"restored": 0, "garbage": str(garbage_dir(config))}
    for path, target in plan:
        target.parent.mkdir(parents=True, exist_ok=True)
        try:
            path.rename(target)
        except OSError as exc:
            raise SessionError(f"撤回 {path} 失败：{exc}") from exc
    _prune_empty(config)
    return {"restored": len(plan), "garbage": str(garbage_dir(config))}


def garbage_purge(config: Config, ids: object) -> dict:
    """彻底删除回收目录里的会话文件，删掉就找不回来。"""
    wanted = _wanted_ids(ids, "要彻底删除的会话")
    groups = _garbage_groups(config)
    removed = 0
    for key in wanted:
        group = groups.get(key)
        if group is None:
            continue
        for path in group["files"]:
            try:
                path.unlink()
            except FileNotFoundError:
                continue
            except OSError as exc:
                raise SessionError(f"删除 {path} 失败：{exc}") from exc
            removed += 1
    _prune_empty(config)
    return {"removed": removed, "garbage": str(garbage_dir(config))}


def _prune_empty(config: Config) -> None:
    """删掉回收目录里空掉的批次与项目目录，不碰回收根。"""
    root = garbage_dir(config)
    if not root.is_dir():
        return
    for path in sorted(root.rglob("*"), key=lambda item: len(item.parts), reverse=True):
        if path.is_dir():
            try:
                path.rmdir()
            except OSError:
                continue


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

    # 一批放一个时间戳目录，里面保持原来的项目/会话相对路径，撤回时原样搬回。
    stamp = time.strftime("%Y%m%d-%H%M%S")
    batch = target_dir / stamp
    index = 1
    while batch.exists():
        batch = target_dir / f"{stamp}-{index}"
        index += 1
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
            target = batch / path.relative_to(root)
            try:
                target.parent.mkdir(parents=True, exist_ok=True)
                path.rename(target)
            except OSError as exc:
                raise SessionError(f"移动 {path} 失败：{exc}") from exc
            moved.append({"from": str(path), "to": str(target)})
    return {"moved": len(moved), "files": moved, "garbage": str(target_dir)}
