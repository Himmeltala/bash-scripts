"""把记录聚合成日报、会话报和时段报，每个模型单独成行，并渲染成对齐的表格。"""

from __future__ import annotations

import unicodedata
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import PurePath

from .model import Record, Usage
from .pricing import PriceBook
from .sources import SOURCE_LABELS, SOURCE_ORDER

MONEY = "¥"

# 行的来路：现扫到的显示空，从账本回显的标成缓存。
ORIGIN_LIVE = "live"
ORIGIN_CACHE = "cache"


@dataclass(slots=True)
class Bucket:
    requests: int = 0
    usage: Usage = field(default_factory=Usage)
    cost_peak: float = 0.0
    cost_off: float = 0.0
    cost_input: float = 0.0
    cost_cache_read: float = 0.0
    cost_cache_write: float = 0.0
    cost_output: float = 0.0
    saved: float = 0.0
    unpriced: int = 0
    from_cache: bool = False

    @property
    def cost(self) -> float:
        return self.cost_peak + self.cost_off

    def add(self, record: Record, book: PriceBook) -> None:
        usage = record.usage
        self.requests += 1
        if getattr(record, "origin", ORIGIN_LIVE) != ORIGIN_LIVE:
            self.from_cache = True
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
        parts = book.parts(record.model, usage, record.at)
        if parts is not None:
            self.cost_input += parts["input"]
            self.cost_cache_read += parts["cache_read"]
            self.cost_cache_write += parts["cache_write"]
            self.cost_output += parts["output"]
        self.saved += book.cache_saved(record.model, usage, record.at) or 0.0
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
    for key in (
        "cost_peak",
        "cost_off",
        "cost",
        "cost_input",
        "cost_cache_read",
        "cost_cache_write",
        "cost_output",
    ):
        total[key] = round(sum(row[key] for row in priced), 8) if priced else None
    known_saved = [row["cache_saved"] for row in rows if row["cache_saved"] is not None]
    total["cache_saved"] = round(sum(known_saved), 8) if known_saved else None
    cache_reads = total["cache_read"]
    cached_inputs = total["input"] + cache_reads
    total["cache_hit"] = cache_reads / cached_inputs if cached_inputs else None
    return total


def _cache_note(rows: list[dict], has_total: bool) -> str:
    """表里有从账本回显的行时，单独列出这些会话占了其中多少，免得和现扫的数字混在一起看。"""
    cached = [row for row in rows if row.get("origin") == ORIGIN_CACHE]
    if not cached:
        return ""
    sessions = len({row.get("session") for row in cached if row.get("session")})
    if not sessions:
        # 按天、按小时、按项目汇总的表没有会话，只能说明口径。
        return "\n\n出处标为缓存的请求，原始会话文件已不在，显示的是删除前最后一次采集的数字。"
    requests = sum(row["requests"] for row in cached)
    # 同一会话每换一次模型或接口就占一行，各行的费用互不重叠，直接相加。
    priced = [row for row in cached if row["cost"] is not None]
    money = _money(sum(row["cost"] for row in priced)) if priced else "--"
    note = (
        f"\n\n出处标为缓存的 {sessions} 个会话、{_number(requests)} 条请求（{money}）"
        "原始会话文件已不在，数字来自删除前最后一次采集；"
    )
    if not has_total:
        return note + "整张表只有缓存行时不出合计。"
    return note + "与上方合计行无关。"


def _unpriced_note(models: list[str], has_total: bool) -> str:
    """表下说明哪些模型没价格，说明 -- 与合计的口径。"""
    if not models:
        return ""
    if has_total:
        return f"\n\n未计价模型：{'、'.join(models)}；这些行没有单价，费用显示 --，合计只累加计得出来的行。"
    return f"\n\n未计价模型：{'、'.join(models)}；这些行没有单价，费用显示 --。"


def _cost_parts_note(total: dict) -> str:
    """表下按 token 类别拆一遍费用，说明钱花在哪一类上。"""
    parts = (
        ("输入未命中", total.get("cost_input")),
        ("缓存读", total.get("cost_cache_read")),
        ("缓存写", total.get("cost_cache_write")),
        ("输出", total.get("cost_output")),
    )
    known = [(label, value) for label, value in parts if value is not None]
    amount = sum(value for _, value in known)
    if amount <= 0:
        return ""
    text = "、".join(
        f"{label} ¥{value:,.4f}（{value / amount * 100:.0f}%）" for label, value in known
    )
    return f"\n\n费用构成：{text}。"


def _model_name(record: Record, book: PriceBook) -> str:
    """表里显示的模型名：别名归到当前在售名，查不到时按原样显示。"""
    return book.resolve(record.model) or "未知"


def _cost_key(bucket: Bucket) -> tuple[bool, float]:
    """费用算得出来的行排在前面，同一档里贵的在前。"""
    return (bucket.unpriced != 0, -bucket.cost)


def daily(records: list[Record], book: PriceBook) -> tuple[list[dict], dict]:
    # 一个来源可能用好几个模型、几个接口，按天、来源、模型、接口分开算，各算各的。
    buckets: dict[tuple[str, str, str, str, str], Bucket] = {}
    for record in records:
        day = record.at.astimezone(book.tz).date().isoformat()
        key = (day, record.source, _model_name(record, book), record.api, _origin(record))
        buckets.setdefault(key, Bucket()).add(record, book)

    order = {name: index for index, name in enumerate(SOURCE_ORDER)}
    rows = []
    for (day, source, model, api, origin), bucket in sorted(
        buckets.items(),
        key=lambda item: (
            item[0][0],
            order.get(item[0][1], 9),
            *_cost_key(item[1]),
            item[0][2],
            item[0][3],
            item[0][4],
        ),
    ):
        rows.append(_row(day, source, bucket, model, api, origin))
    return rows, _totals(rows)


def sessions(records: list[Record], book: PriceBook) -> tuple[list[dict], dict]:
    buckets: dict[tuple[str, str, str, str, str], Bucket] = {}
    projects: dict[str, str] = {}
    span: dict[tuple[str, str, str, str, str], list[datetime]] = {}
    for record in records:
        key = (
            record.source,
            record.session,
            _model_name(record, book),
            record.api,
            _origin(record),
        )
        buckets.setdefault(key, Bucket()).add(record, book)
        if record.project:
            projects[record.session] = record.project
        times = span.setdefault(key, [record.at, record.at])
        times[0] = min(times[0], record.at)
        times[1] = max(times[1], record.at)

    order = {name: index for index, name in enumerate(SOURCE_ORDER)}
    rows = []
    for key in sorted(
        buckets,
        key=lambda k: (
            order.get(k[0], 9),
            span[k][0],
            *_cost_key(buckets[k]),
            k[2],
            k[3],
            k[4],
        ),
    ):
        bucket = buckets[key]
        row = _row("", key[0], bucket, key[2], key[3], key[4])
        row.update(
            session=key[1],
            project=_project_name(projects.get(key[1], "")),
            start=span[key][0].astimezone(book.tz).strftime("%m-%d %H:%M"),
            end=span[key][1].astimezone(book.tz).strftime("%m-%d %H:%M"),
        )
        row.pop("date", None)
        rows.append(row)
    return rows, _totals(rows)


def session_totals(records: list[Record], book: PriceBook) -> tuple[list[dict], dict]:
    """每个会话一行：把同一会话的多个模型、多个接口合起来，按费用从高到低排。"""
    buckets: dict[tuple[str, str], Bucket] = {}
    spans: dict[tuple[str, str], list[datetime]] = {}
    projects: dict[tuple[str, str], str] = {}
    models: dict[tuple[str, str], set[str]] = {}
    origins: dict[tuple[str, str], str] = {}
    for record in records:
        key = (record.source, record.session)
        buckets.setdefault(key, Bucket()).add(record, book)
        times = spans.setdefault(key, [record.at, record.at])
        times[0] = min(times[0], record.at)
        times[1] = max(times[1], record.at)
        if record.project:
            projects[key] = record.project
        models.setdefault(key, set()).add(_model_name(record, book))
        if _origin(record) != ORIGIN_LIVE:
            origins[key] = ORIGIN_CACHE
        else:
            origins.setdefault(key, ORIGIN_LIVE)

    order = {name: index for index, name in enumerate(SOURCE_ORDER)}
    rows = []
    for key in sorted(
        buckets,
        key=lambda k: (
            *_cost_key(buckets[k]),
            spans[k][0],
            order.get(k[0], 9),
            k[1],
        ),
    ):
        bucket = buckets[key]
        row = _row("", key[0], bucket, "", "", origins.get(key, ORIGIN_LIVE))
        row.pop("date", None)
        start, end = spans[key]
        row.update(
            session=key[1],
            project=_project_name(projects.get(key, "")),
            start=start.astimezone(book.tz).strftime("%m-%d %H:%M"),
            end=end.astimezone(book.tz).strftime("%m-%d %H:%M"),
            duration=max(0, int((end - start).total_seconds())),
            models="、".join(sorted(models[key])),
        )
        rows.append(row)
    return rows, _totals(rows)


def hours(records: list[Record], book: PriceBook) -> tuple[list[dict], dict]:
    # 同一个小时里，各来源、各模型、各接口分开算，各算各的。
    buckets: dict[tuple[int, str, str, str, str], Bucket] = {}
    for record in records:
        local = record.at.astimezone(book.tz)
        key = (local.hour, record.source, _model_name(record, book), record.api, _origin(record))
        buckets.setdefault(key, Bucket()).add(record, book)

    order = {name: index for index, name in enumerate(SOURCE_ORDER)}
    rows = []
    for (hour, source, model, api, origin), bucket in sorted(
        buckets.items(),
        key=lambda item: (
            item[0][0],
            order.get(item[0][1], 9),
            *_cost_key(item[1]),
            item[0][2],
            item[0][3],
            item[0][4],
        ),
    ):
        row = _row(f"{hour:02d}:00", _slot_label(hour, book), bucket, model, api, origin)
        row["slot"] = row.pop("date")
        row["label"] = row.pop("source")
        row["hour"] = hour
        row["source"] = source
        rows.append(row)
    return rows, _totals(rows)


def projects(records: list[Record], book: PriceBook) -> tuple[list[dict], dict]:
    # 一个项目里可能有好几个来源、模型与接口，各算各的行，项目之间按合计费用从高到低排。
    buckets: dict[tuple[str, str, str, str, str], Bucket] = {}
    for record in records:
        key = (
            record.project,
            record.source,
            _model_name(record, book),
            record.api,
            _origin(record),
        )
        buckets.setdefault(key, Bucket()).add(record, book)

    labels = _project_labels({key[0] for key in buckets})
    money: dict[str, float] = {}
    for key, bucket in buckets.items():
        if bucket.unpriced == 0:
            money[key[0]] = money.get(key[0], 0.0) + bucket.cost
    rank = {
        path: index
        for index, path in enumerate(
            sorted(money, key=lambda path: (-money[path], labels.get(path, path)))
        )
    }
    # 全是未计价模型的项目没有金额可比，按名字排在最后。
    rest = sorted(
        {key[0] for key in buckets} - set(rank),
        key=lambda path: labels.get(path, path),
    )
    for path in rest:
        rank[path] = len(rank)

    order = {name: index for index, name in enumerate(SOURCE_ORDER)}
    rows = []
    for key in sorted(
        buckets,
        key=lambda k: (
            rank[k[0]],
            order.get(k[1], 9),
            *_cost_key(buckets[k]),
            k[2],
            k[3],
            k[4],
        ),
    ):
        row = _row("", key[1], buckets[key], key[2], key[3], key[4])
        row.pop("date", None)
        row["project"] = labels.get(key[0], key[0])
        rows.append(row)
    return rows, _totals(rows)


def _project_labels(paths: set[str]) -> dict[str, str]:
    """项目列显示目录名；不同路径同名时补上一级目录，不把两个项目并成一行。"""
    bases: dict[str, set[str]] = {}
    for path in paths:
        bases.setdefault(_project_name(path), set()).add(path)
    labels: dict[str, str] = {}
    for path in paths:
        name = _project_name(path)
        if path and len(bases[name]) > 1:
            parent = PurePath(path).parent.name
            labels[path] = f"{parent}/{name}" if parent else name
        else:
            labels[path] = name
    # 补一级目录还撞名时退回完整路径，宁可长一点也不能把两个项目混成一行。
    same: dict[str, int] = {}
    for label in labels.values():
        same[label] = same.get(label, 0) + 1
    for path, label in labels.items():
        if path and same[label] > 1:
            labels[path] = path
    return labels


def _origin(record: Record) -> str:
    return getattr(record, "origin", ORIGIN_LIVE)


def _row(
    key_a: str,
    key_b: str,
    bucket: Bucket,
    model: str,
    api: str,
    origin: str = ORIGIN_LIVE,
) -> dict:
    usage = bucket.usage
    # 一条记录查不到价格，这一行的费用就算不全，三个费用列与缓存节省都留空。
    known = bucket.unpriced == 0
    cached_inputs = usage.input + usage.cache_read
    return {
        "date": key_a,
        "source": key_b,
        "model": model,
        "api": api,
        "requests": bucket.requests,
        "input": usage.input,
        "cache_read": usage.cache_read,
        "cache_write": usage.cache_write,
        "output": usage.output,
        "total_tokens": usage.total,
        "cache_hit": usage.cache_read / cached_inputs if cached_inputs else None,
        "cache_saved": round(bucket.saved, 8) if known else None,
        "cost_peak": round(bucket.cost_peak, 8) if known else None,
        "cost_off": round(bucket.cost_off, 8) if known else None,
        "cost": round(bucket.cost, 8) if known else None,
        "cost_input": round(bucket.cost_input, 8) if known else None,
        "cost_cache_read": round(bucket.cost_cache_read, 8) if known else None,
        "cost_cache_write": round(bucket.cost_cache_write, 8) if known else None,
        "cost_output": round(bucket.cost_output, 8) if known else None,
        "unpriced": bucket.unpriced,
        "origin": origin,
    }


def _slot_label(hour: int, book: PriceBook) -> str:
    for start, end in book.windows:
        if start.hour <= hour < end.hour:
            return "高峰窗口"
    return "空闲"


def _origin_name(row: dict) -> str:
    return "缓存" if row.get("origin") == ORIGIN_CACHE else ""


def _short_session(session: str) -> str:
    if len(session) <= 12:
        return session
    return session[:10] + ".."


def _duration(seconds: int) -> str:
    if seconds < 60:
        return f"{seconds} 秒"
    minutes = seconds // 60
    if minutes < 60:
        return f"{minutes} 分"
    hours, rest = divmod(minutes, 60)
    return f"{hours} 小时 {rest:02d} 分"


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
            row["model"],
            row["api"] or "-",
            row["date"],
            _origin_name(row),
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
            "模型",
            "API 地址",
            "日期",
            "出处",
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
        [
            "left",
            "left",
            "left",
            "left",
            "left",
            "right",
            "right",
            "right",
            "right",
            "right",
            "right",
            "right",
            "right",
        ],
    ) + _cache_note(rows, has_total) + _unpriced_note(unpriced or [], has_total) + _cost_parts_note(total)


def table_sessions(rows: list[dict], total: dict, unpriced: list[str] | None = None) -> str:
    has_total = len(rows) > 1
    body = [
        [
            row["source"],
            row["model"],
            row["api"] or "-",
            row["start"],
            _short_session(row["session"]),
            row["project"] or "-",
            _origin_name(row),
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
                "",
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
            ]
        )
    return render(
        ["来源", "模型", "API 地址", "开始", "会话", "项目", "出处", "请求", "输入", "缓存读", "输出", "总 token", "高峰费用", "空闲费用", "合计"],
        body,
        [
            "left",
            "left",
            "left",
            "left",
            "left",
            "left",
            "left",
            "right",
            "right",
            "right",
            "right",
            "right",
            "right",
            "right",
            "right",
        ],
    ) + _cache_note(rows, has_total) + _unpriced_note(unpriced or [], has_total) + _cost_parts_note(total)


def table_session_totals(rows: list[dict], total: dict, unpriced: list[str] | None = None) -> str:
    has_total = len(rows) > 1
    body = [
        [
            row["source"],
            _short_session(row["session"]),
            row["project"] or "-",
            row["start"],
            _duration(row["duration"]),
            _origin_name(row),
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
            ]
        )
    return render(
        ["来源", "会话", "项目", "开始", "时长", "出处", "请求", "输入", "缓存读", "输出", "总 token", "高峰费用", "空闲费用", "合计"],
        body,
        [
            "left",
            "left",
            "left",
            "left",
            "left",
            "left",
            "right",
            "right",
            "right",
            "right",
            "right",
            "right",
            "right",
            "right",
        ],
    ) + _cache_note(rows, has_total) + _unpriced_note(unpriced or [], has_total) + _cost_parts_note(total)


def table_hours(rows: list[dict], total: dict, unpriced: list[str] | None = None) -> str:
    body = [
        [
            SOURCE_LABELS.get(row["source"], row["source"]),
            row["model"],
            row["api"] or "-",
            row["slot"],
            row["label"],
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
            "来源",
            "模型",
            "API 地址",
            "小时",
            "时段",
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
        [
            "left",
            "left",
            "left",
            "left",
            "left",
            "right",
            "right",
            "right",
            "right",
            "right",
            "right",
            "right",
            "right",
        ],
    ) + _unpriced_note(unpriced or [], False) + _cost_parts_note(total)


def table_projects(rows: list[dict], total: dict, unpriced: list[str] | None = None) -> str:
    has_total = len(rows) > 1
    body = [
        [
            row["project"] or "-",
            row["source"],
            row["model"],
            row["api"] or "-",
            _origin_name(row),
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
        ["项目", "来源", "模型", "API 地址", "出处", "请求", "输入", "缓存读", "输出", "总 token", "高峰费用", "空闲费用", "合计"],
        body,
        [
            "left",
            "left",
            "left",
            "left",
            "left",
            "right",
            "right",
            "right",
            "right",
            "right",
            "right",
            "right",
            "right",
        ],
    ) + _cache_note(rows, has_total) + _unpriced_note(unpriced or [], has_total) + _cost_parts_note(total)


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
