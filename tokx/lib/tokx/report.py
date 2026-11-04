"""把记录聚合成日报、会话报和时段报，每个模型单独成行，并渲染成对齐的表格。"""

from __future__ import annotations

import unicodedata
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import PurePath

from .model import Record, Usage
from .pricing import PriceBook
from .sources import SOURCE_ORDER

MONEY = "¥"


@dataclass(slots=True)
class Bucket:
    requests: int = 0
    usage: Usage = field(default_factory=Usage)
    cost_peak: float = 0.0
    cost_off: float = 0.0
    unpriced: int = 0

    @property
    def cost(self) -> float:
        return self.cost_peak + self.cost_off

    def add(self, record: Record, book: PriceBook) -> None:
        usage = record.usage
        self.requests += 1
        self.usage = Usage(
            input=self.usage.input + usage.input,
            cache_read=self.usage.cache_read + usage.cache_read,
            cache_write=self.usage.cache_write + usage.cache_write,
            output=self.usage.output + usage.output,
            reasoning=self.usage.reasoning + usage.reasoning,
        )
        cost = book.cost(record.model, usage, record.at)
        if cost is None:
            self.unpriced += 1
            return
        if book.is_peak(record.at):
            self.cost_peak += cost
        else:
            self.cost_off += cost


def _money(value: float) -> str:
    return f"{MONEY}{value:,.4f}"


def _cost(value: float | None) -> str:
    """费用算不全时显示 --，表示没有可用的金额，而不是 0。"""
    return "--" if value is None else _money(value)


def _number(value: int) -> str:
    return f"{value:,}"


def _totals(rows: list[dict]) -> dict:
    # 费用只累加算得完整的行；请求数与 token 照旧全算。
    priced = [row for row in rows if row["cost"] is not None]
    total = {
        "requests": sum(row["requests"] for row in rows),
        "input": sum(row["input"] for row in rows),
        "cache_read": sum(row["cache_read"] for row in rows),
        "cache_write": sum(row["cache_write"] for row in rows),
        "output": sum(row["output"] for row in rows),
        "total_tokens": sum(row["total_tokens"] for row in rows),
        "unpriced": sum(row["unpriced"] for row in rows),
    }
    for key in ("cost_peak", "cost_off", "cost"):
        total[key] = round(sum(row[key] for row in priced), 8) if priced else None
    return total


def _unpriced_note(models: list[str], has_total: bool) -> str:
    """表下说明哪些模型没价格，说明 -- 与合计的口径。"""
    if not models:
        return ""
    if has_total:
        return f"\n\n未计价模型：{'、'.join(models)}；这些行没有单价，费用显示 --，合计只累加计得出来的行。"
    return f"\n\n未计价模型：{'、'.join(models)}；这些行没有单价，费用显示 --。"


def _model_name(record: Record, book: PriceBook) -> str:
    """表里显示的模型名：别名归到当前在售名，查不到时按原样显示。"""
    return book.resolve(record.model) or "未知"


def _cost_key(bucket: Bucket) -> tuple[bool, float]:
    """费用算得出来的行排在前面，同一档里贵的在前。"""
    return (bucket.unpriced != 0, -bucket.cost)


def daily(records: list[Record], book: PriceBook) -> tuple[list[dict], dict]:
    # 一个来源可能用好几个模型，按天、来源、模型三者分开算，费用才不会互相牵连。
    buckets: dict[tuple[str, str, str], Bucket] = {}
    for record in records:
        day = record.at.astimezone(book.tz).date().isoformat()
        key = (day, record.source, _model_name(record, book))
        buckets.setdefault(key, Bucket()).add(record, book)

    order = {name: index for index, name in enumerate(SOURCE_ORDER)}
    rows = []
    for (day, source, model), bucket in sorted(
        buckets.items(),
        key=lambda item: (item[0][0], order.get(item[0][1], 9), *_cost_key(item[1]), item[0][2]),
    ):
        rows.append(_row(day, source, bucket, model))
    return rows, _totals(rows)


def sessions(records: list[Record], book: PriceBook) -> tuple[list[dict], dict]:
    buckets: dict[tuple[str, str, str], Bucket] = {}
    projects: dict[str, str] = {}
    span: dict[tuple[str, str, str], list[datetime]] = {}
    for record in records:
        key = (record.source, record.session, _model_name(record, book))
        buckets.setdefault(key, Bucket()).add(record, book)
        if record.project:
            projects[record.session] = record.project
        times = span.setdefault(key, [record.at, record.at])
        times[0] = min(times[0], record.at)
        times[1] = max(times[1], record.at)

    order = {name: index for index, name in enumerate(SOURCE_ORDER)}
    rows = []
    for key in sorted(
        buckets, key=lambda k: (order.get(k[0], 9), span[k][0], *_cost_key(buckets[k]), k[2])
    ):
        bucket = buckets[key]
        row = _row("", key[0], bucket, key[2])
        row.update(
            session=key[1],
            project=_project_name(projects.get(key[1], "")),
            start=span[key][0].astimezone(book.tz).strftime("%m-%d %H:%M"),
            end=span[key][1].astimezone(book.tz).strftime("%m-%d %H:%M"),
        )
        row.pop("date", None)
        rows.append(row)
    return rows, _totals(rows)


def hours(records: list[Record], book: PriceBook) -> tuple[list[dict], dict]:
    buckets: dict[tuple[int, str], Bucket] = {}
    for record in records:
        local = record.at.astimezone(book.tz)
        buckets.setdefault((local.hour, _model_name(record, book)), Bucket()).add(record, book)

    rows = []
    for (hour, model), bucket in sorted(
        buckets.items(), key=lambda item: (item[0][0], *_cost_key(item[1]), item[0][1])
    ):
        row = _row(f"{hour:02d}:00", _slot_label(hour, book), bucket, model)
        row["slot"] = row.pop("date")
        row["label"] = row.pop("source")
        row["hour"] = hour
        rows.append(row)
    return rows, _totals(rows)


def _row(key_a: str, key_b: str, bucket: Bucket, model: str) -> dict:
    usage = bucket.usage
    # 一条记录查不到价格，这一行的费用就算不全，三个费用列都留空。
    known = bucket.unpriced == 0
    return {
        "date": key_a,
        "source": key_b,
        "model": model,
        "requests": bucket.requests,
        "input": usage.input,
        "cache_read": usage.cache_read,
        "cache_write": usage.cache_write,
        "output": usage.output,
        "total_tokens": usage.total,
        "cost_peak": round(bucket.cost_peak, 8) if known else None,
        "cost_off": round(bucket.cost_off, 8) if known else None,
        "cost": round(bucket.cost, 8) if known else None,
        "unpriced": bucket.unpriced,
    }


def _slot_label(hour: int, book: PriceBook) -> str:
    for start, end in book.windows:
        if start.hour <= hour < end.hour:
            return "高峰窗口"
    return "空闲"


def _short_session(session: str) -> str:
    if len(session) <= 12:
        return session
    return session[:10] + ".."


def _project_name(path: str) -> str:
    if not path:
        return ""
    return PurePath(path).name


def render(headers: list[str], rows: list[list[str]], aligns: list[str]) -> str:
    """按东亚字符宽度补齐，输出对齐的纯文本表格。"""
    widths = [display_width(item) for item in headers]
    for row in rows:
        for index, cell in enumerate(row):
            widths[index] = max(widths[index], display_width(cell))

    lines = [
        "  ".join(pad(headers[index], widths[index], aligns[index]) for index in range(len(headers))),
        "  ".join("-" * width for width in widths),
    ]
    for row in rows:
        lines.append(
            "  ".join(pad(row[index], widths[index], aligns[index]) for index in range(len(headers)))
        )
    return "\n".join(lines)


def display_width(text: str) -> int:
    return sum(2 if unicodedata.east_asian_width(char) in "WF" else 1 for char in text)


def pad(text: str, width: int, align: str = "left") -> str:
    gap = width - display_width(text)
    if gap <= 0:
        return text
    if align == "right":
        return " " * gap + text
    if align == "center":
        left = gap // 2
        return " " * left + text + " " * (gap - left)
    return text + " " * gap


def table_daily(rows: list[dict], total: dict, unpriced: list[str] | None = None) -> str:
    has_total = len(rows) > 1
    body = [
        [
            row["source"] or "",
            row["date"],
            row["model"],
            _number(row["requests"]),
            _number(row["input"]),
            _number(row["cache_read"]),
            _number(row["output"]),
            _number(row["total_tokens"]),
            _cost(row["cost_peak"]),
            _cost(row["cost_off"]),
            _cost(row["cost"]),
        ]
        for row in rows
    ]
    if has_total:
        body.append(
            [
                "合计",
                "",
                "",
                _number(total["requests"]),
                _number(total["input"]),
                _number(total["cache_read"]),
                _number(total["output"]),
                _number(total["total_tokens"]),
                _cost(total["cost_peak"]),
                _cost(total["cost_off"]),
                _cost(total["cost"]),
            ]
        )
    return render(
        [
            "来源",
            "日期",
            "模型",
            "请求",
            "输入",
            "缓存读",
            "输出",
            "总 token",
            "高峰费用",
            "空闲费用",
            "合计",
        ],
        body,
        ["left", "left", "left", "right", "right", "right", "right", "right", "right", "right", "right"],
    ) + _unpriced_note(unpriced or [], has_total)


def table_sessions(rows: list[dict], total: dict, unpriced: list[str] | None = None) -> str:
    has_total = len(rows) > 1
    body = [
        [
            row["source"],
            _short_session(row["session"]),
            row["project"] or "-",
            row["model"],
            _number(row["requests"]),
            _number(row["input"]),
            _number(row["cache_read"]),
            _number(row["output"]),
            _number(row["total_tokens"]),
            _cost(row["cost_peak"]),
            _cost(row["cost_off"]),
            _cost(row["cost"]),
            row["start"],
        ]
        for row in rows
    ]
    if has_total:
        body.append(
            [
                "合计",
                "",
                "",
                "",
                _number(total["requests"]),
                _number(total["input"]),
                _number(total["cache_read"]),
                _number(total["output"]),
                _number(total["total_tokens"]),
                _cost(total["cost_peak"]),
                _cost(total["cost_off"]),
                _cost(total["cost"]),
                "",
            ]
        )
    return render(
        ["来源", "会话", "项目", "模型", "请求", "输入", "缓存读", "输出", "总 token", "高峰费用", "空闲费用", "合计", "开始"],
        body,
        ["left", "left", "left", "left", "right", "right", "right", "right", "right", "right", "right", "right", "left"],
    ) + _unpriced_note(unpriced or [], has_total)


def table_hours(rows: list[dict], total: dict, unpriced: list[str] | None = None) -> str:
    body = [
        [
            row["slot"],
            row["label"],
            row["model"],
            _number(row["requests"]),
            _number(row["input"]),
            _number(row["cache_read"]),
            _number(row["output"]),
            _number(row["total_tokens"]),
            _cost(row["cost_peak"]),
            _cost(row["cost_off"]),
            _cost(row["cost"]),
        ]
        for row in rows
    ]
    return render(
        [
            "时段",
            "档位",
            "模型",
            "请求",
            "输入",
            "缓存读",
            "输出",
            "总 token",
            "高峰费用",
            "空闲费用",
            "合计",
        ],
        body,
        ["left", "left", "left", "right", "right", "right", "right", "right", "right", "right", "right"],
    ) + _unpriced_note(unpriced or [], False)


def table_prices(book: PriceBook) -> str:
    body = []
    for name in sorted(book.models):
        price = book.models[name]
        if price.free:
            body.append([name, "免费", "-", "-", "-", "-", "-", "-"])
            continue
        body.append(
            [
                name,
                "计费",
                f"{price.off.hit:g}",
                f"{price.off.miss:g}",
                f"{price.off.output:g}",
                f"{price.peak.hit:g}",
                f"{price.peak.miss:g}",
                f"{price.peak.output:g}",
            ]
        )
    return render(
        ["模型", "状态", "空闲·命中", "空闲·未命中", "空闲·输出", "高峰·命中", "高峰·未命中", "高峰·输出"],
        body,
        ["left", "left", "right", "right", "right", "right", "right", "right"],
    ) + "\n\n单价单位：元每百万 token。"
