"""预算：总额的日、周、月上限与分项的月度上限，存一份 JSON 供所有页面共用。

文件放在缓存目录的 llmx 下，和账本、配置档同一处；页面只负责读写这份文件，
花费仍按当前价格表从日报现算，口径与命令行一致。
"""

from __future__ import annotations

import json
import math
import os
import tempfile
import threading
from pathlib import Path

KINDS = ("model", "project", "api")
PERIODS = ("daily", "weekly", "monthly")
MAX_ITEMS = 200
LOCK = threading.Lock()

PERIOD_NAMES = {"daily": "每日", "weekly": "每周", "monthly": "每月"}
KIND_NAMES = {"model": "模型", "project": "项目", "api": "API"}


class BudgetError(Exception):
    """预算内容不合法或文件读写失败时抛出，消息直接展示给用户。"""


def budget_path(state: Path) -> Path:
    """预算文件的位置：与账本同在缓存目录下。"""
    return state / "budgets.json"


def default() -> dict:
    return {"daily": 0.0, "weekly": 0.0, "monthly": 0.0, "items": []}


def _number(value: object, where: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float, str)):
        raise BudgetError(f"{where}需要是数字")
    try:
        number = float(value)
    except ValueError as exc:
        raise BudgetError(f"{where}需要是数字") from exc
    if not math.isfinite(number):
        raise BudgetError(f"{where}需要是有限的数字")
    if number < 0:
        raise BudgetError(f"{where}不能是负数")
    return round(number, 4)


def normalize(data: object) -> dict:
    """校验并收窄成固定结构，0 表示不设上限。"""
    if not isinstance(data, dict):
        raise BudgetError("预算需要写成一个对象")
    out: dict[str, object] = {
        key: _number(data.get(key, 0), f"{PERIOD_NAMES[key]}预算") for key in PERIODS
    }
    items = data.get("items") or []
    if not isinstance(items, list):
        raise BudgetError("分项预算需要写成列表")
    if len(items) > MAX_ITEMS:
        raise BudgetError(f"分项预算最多 {MAX_ITEMS} 条")
    seen: set[tuple[str, str]] = set()
    saved = []
    for index, item in enumerate(items, 1):
        if not isinstance(item, dict):
            raise BudgetError(f"第 {index} 条分项预算需要写成对象")
        kind = str(item.get("kind") or "").strip()
        if kind not in KINDS:
            raise BudgetError(f"第 {index} 条分项预算的类型只能是 {'、'.join(KIND_NAMES.values())}")
        name = str(item.get("name") or "").strip()
        if not name:
            raise BudgetError(f"第 {index} 条分项预算缺少名称")
        limit = _number(item.get("limit", 0), f"第 {index} 条分项预算的上限")
        if limit <= 0:
            raise BudgetError(f"第 {index} 条分项预算的上限要大于 0")
        key = (kind, name)
        if key in seen:
            raise BudgetError(f"{KIND_NAMES[kind]} {name} 的分项预算重复了")
        seen.add(key)
        saved.append({"kind": kind, "name": name, "limit": limit})
    out["items"] = saved
    return out


def load(state: Path) -> dict:
    path = budget_path(state)
    if not path.is_file():
        return default()
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise BudgetError(f"读不了预算文件 {path}: {exc}") from exc
    return normalize(data)


def save(state: Path, data: object) -> dict:
    value = normalize(data)
    path = budget_path(state)
    with LOCK:
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            fd, temp = tempfile.mkstemp(prefix=".budgets-", suffix=".json", dir=path.parent)
            try:
                with os.fdopen(fd, "w", encoding="utf-8") as handle:
                    json.dump(value, handle, ensure_ascii=False, indent=2)
                    handle.write("\n")
                os.replace(temp, path)
            except OSError:
                # 写一半失败时别把临时文件留下。
                if os.path.exists(temp):
                    os.unlink(temp)
                raise
        except OSError as exc:
            raise BudgetError(f"写不了预算文件 {path}: {exc}") from exc
    return value
