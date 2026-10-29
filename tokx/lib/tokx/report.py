"""把记录聚合成日报、会话报和时段报，并渲染成对齐的表格。"""

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


def _number(value: int) -> str:
    return f"{value:,}"


def _totals(rows: list[dict]) -> dict:
    total = {
        "requests": sum(row["requests"] for row in rows),
        "input": sum(row["input"] for row in rows),
        "cache_read": sum(row["cache_read"] for row in rows),
        "cache_write": sum(row["cache_write"] for row in rows),
        "output": sum(row["output"] for row in rows),
        "total_tokens": sum(row["total_tokens"] for row in rows),
        "cost_peak": sum(row["cost_peak"] for row in rows),
        "cost_off": sum(row["cost_off"] for row in rows),
        "cost": sum(row["cost"] for row in rows),
        "unpriced": sum(row["unpriced"] for row in rows),
    }
    return total


def daily(records: list[Record], book: PriceBook) -> tuple[list[dict], dict]:
    buckets: dict[tuple[str, str], Bucket] = {}
    for record in records:
        day = record.at.astimezone(book.tz).date().isoformat()
        buckets.setdefault((day, record.source), Bucket()).add(record, book)

    order = {name: index for index, name in enumerate(SOURCE_ORDER)}
    rows = []
    for (day, source), bucket in sorted(buckets.items(), key=lambda item: (item[0][0], order.get(item[0][1], 9))):
        rows.append(_row(day, source, bucket))
    return rows, _totals(rows)


def sessions(records: list[Record], book: PriceBook) -> tuple[list[dict], dict]:
    buckets: dict[tuple[str, str], Bucket] = {}
    models: dict[tuple[str, str], set[str]] = {}
    projects: dict[str, str] = {}
    span: dict[tuple[str, str], list[datetime]] = {}
    for record in records:
        key = (record.source, record.session)
        buckets.setdefault(key, Bucket()).add(record, book)
        models.setdefault(key, set()).add(record.model or "未知")
        if record.project:
            projects[key[1]] = record.project
        times = span.setdefault(key, [record.at, record.at])
        times[0] = min(times[0], record.at)
        times[1] = max(times[1], record.at)

    order = {name: index for index, name in enumerate(SOURCE_ORDER)}
    rows = []
    for key in sorted(buckets, key=lambda k: (order.get(k[0], 9), span[k][0])):
        bucket = buckets[key]
        row = _row("", key[0], bucket)
        row.update(
            session=key[1],
            project=_project_name(projects.get(key[1], "")),
            model=_model_label(models[key]),
            start=span[key][0].astimezone(book.tz).strftime("%m-%d %H:%M"),
            end=span[key][1].astimezone(book.tz).strftime("%m-%d %H:%M"),
        )
        row.pop("date", None)
        rows.append(row)
    return rows, _totals(rows)


def hours(records: list[Record], book: PriceBook) -> tuple[list[dict], dict]:
    buckets: dict[int, Bucket] = {}
    for record in records:
        local = record.at.astimezone(book.tz)
        buckets.setdefault(local.hour, Bucket()).add(record, book)

    rows = []
    for hour, bucket in sorted(buckets.items()):
        row = _row(f"{hour:02d}:00", _slot_label(hour, book), bucket)
        row["slot"] = row.pop("date")
        row["label"] = row.pop("source")
        row["hour"] = hour
        rows.append(row)
    return rows, _totals(rows)


def _row(key_a: str, key_b: str, bucket: Bucket) -> dict:
    usage = bucket.usage
    return {
        "date": key_a,
        "source": key_b,
        "requests": bucket.requests,
        "input": usage.input,
        "cache_read": usage.cache_read,
        "cache_write": usage.cache_write,
        "output": usage.output,
        "total_tokens": usage.total,
        "cost_peak": round(bucket.cost_peak, 8),
        "cost_off": round(bucket.cost_off, 8),
        "cost": round(bucket.cost, 8),
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


def _model_label(models: set[str]) -> str:
    names = sorted(models)
    if len(names) <= 2:
        return ", ".join(names)
    return f"{names[0]} 等 {len(names)} 个"


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


def table_daily(rows: list[dict], total: dict) -> str:
    body = [
        [
            row["source"] or "",
            row["date"],
            _number(row["requests"]),
            _number(row["input"]),
            _number(row["cache_read"]),
            _number(row["output"]),
            _number(row["total_tokens"]),
            _money(row["cost_peak"]),
            _money(row["cost_off"]),
            _money(row["cost"]),
        ]
        for row in rows
    ]
    if len(rows) > 1:
        body.append(
            [
                "合计",
                "",
                _number(total["requests"]),
                _number(total["input"]),
                _number(total["cache_read"]),
                _number(total["output"]),
                _number(total["total_tokens"]),
                _money(total["cost_peak"]),
                _money(total["cost_off"]),
                _money(total["cost"]),
            ]
        )
    return render(
        ["来源", "日期", "请求", "输入", "缓存读", "输出", "总 token", "高峰费用", "空闲费用", "合计"],
        body,
        ["left", "left", "right", "right", "right", "right", "right", "right", "right", "right"],
    )


def table_sessions(rows: list[dict], total: dict) -> str:
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
            _money(row["cost_peak"]),
            _money(row["cost_off"]),
            _money(row["cost"]),
            row["start"],
        ]
        for row in rows
    ]
    if len(rows) > 1:
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
                _money(total["cost_peak"]),
                _money(total["cost_off"]),
                _money(total["cost"]),
                "",
            ]
        )
    return render(
        ["来源", "会话", "项目", "模型", "请求", "输入", "缓存读", "输出", "总 token", "高峰费用", "空闲费用", "合计", "开始"],
        body,
        ["left", "left", "left", "left", "right", "right", "right", "right", "right", "right", "right", "right", "left"],
    )


def table_hours(rows: list[dict], total: dict) -> str:
    body = [
        [
            row["slot"],
            row["label"],
            _number(row["requests"]),
            _number(row["input"]),
            _number(row["cache_read"]),
            _number(row["output"]),
            _number(row["total_tokens"]),
            _money(row["cost_peak"]),
            _money(row["cost_off"]),
            _money(row["cost"]),
        ]
        for row in rows
    ]
    return render(
        ["时段", "档位", "请求", "输入", "缓存读", "输出", "总 token", "高峰费用", "空闲费用", "合计"],
        body,
        ["left", "left", "right", "right", "right", "right", "right", "right", "right", "right"],
    )


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
