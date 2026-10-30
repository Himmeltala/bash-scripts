"""命令行入口：参数解析、数据汇总与输出。"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime, timedelta

from . import report
from .config import Config, ConfigError, load
from .pricing import PriceBook
from .sources import SOURCE_LABELS, SOURCE_ORDER, SourceError, collect

VERSION = "0.2.0"
COMMANDS = ("daily", "session", "hour", "prices")


class UsageError(Exception):
    """参数写错时抛出，打印消息后以 2 退出。"""


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="tokx",
        description="统计 Claude Code、opencode、DeepSeek Harness 的 token 用量与费用，按 DeepSeek 峰谷价计费。",
        epilog="不带参数运行且连着终端时打开菜单，也可以显式写 tokx menu。",
    )
    parser.add_argument("--version", action="version", version=f"tokx {VERSION}")
    _add_common(parser, suppress=False)

    sub = parser.add_subparsers(dest="command", metavar="命令")
    suppressed = argparse.ArgumentParser(add_help=False)
    _add_common(suppressed, suppress=True)
    for name, text in (
        ("daily", "按天汇总，默认命令"),
        ("session", "按会话汇总"),
        ("hour", "按一天内的小时分布汇总"),
        ("prices", "打印当前价格表"),
    ):
        sub.add_parser(name, parents=[suppressed], help=text, description=text)
    return parser


def _add_common(parser: argparse.ArgumentParser, suppress: bool) -> None:
    """主命令与子命令共用同一组选项；子命令用 SUPPRESS 避免覆盖主命令的取值。"""
    defaults = {"default": argparse.SUPPRESS} if suppress else {}
    parser.add_argument(
        "-s",
        "--source",
        action="append",
        metavar="名称",
        help="只看某个来源，可选 claude、opencode、dsh，可重复",
        **defaults,
    )
    parser.add_argument("--since", metavar="YYYY-MM-DD", help="起始日期，含当天", **defaults)
    parser.add_argument("--until", metavar="YYYY-MM-DD", help="结束日期，含当天", **defaults)
    parser.add_argument("--days", type=int, metavar="N", help="最近 N 天，默认 14", **defaults)
    parser.add_argument("--all", action="store_true", help="不限日期", **defaults)
    parser.add_argument("--json", action="store_true", help="输出 JSON", **defaults)
    parser.add_argument("--config", metavar="路径", help="指定配置文件", **defaults)


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    command = getattr(args, "command", None) or "daily"
    if command not in COMMANDS:
        parser.error(f"未知命令 {command}")

    try:
        config = load(getattr(args, "config", None))
    except ConfigError as exc:
        print(f"tokx: {exc}", file=sys.stderr)
        return 2

    if command == "prices":
        return _print_prices(config.book, getattr(args, "json", False))

    try:
        sources = _pick_sources(getattr(args, "source", None))
        since, until = _range(args, config.book)
    except UsageError as exc:
        print(f"tokx: {exc}", file=sys.stderr)
        return 2

    records = []
    for source in sources:
        try:
            records.extend(collect(source, config.paths))
        except (SourceError, OSError) as exc:
            print(f"tokx: 跳过 {SOURCE_LABELS[source]}: {exc}", file=sys.stderr)

    records = [record for record in records if _in_range(record.at, config.book, since, until)]
    records.sort(key=lambda record: record.at)

    if not records:
        print("没有找到用量记录。", file=sys.stderr)
        return 0

    book = config.book
    if command == "session":
        rows, total = report.sessions(records, book)
        text = report.table_sessions(rows, total)
    elif command == "hour":
        rows, total = report.hours(records, book)
        text = report.table_hours(rows, total)
    else:
        rows, total = report.daily(records, book)
        text = report.table_daily(rows, total)

    if getattr(args, "json", False):
        print(
            json.dumps(
                {
                    "command": command,
                    "since": since.isoformat() if since else None,
                    "until": until.isoformat() if until else None,
                    "timezone": str(book.tz),
                    "currency": "CNY",
                    "rows": rows,
                    "totals": total,
                },
                ensure_ascii=False,
                indent=2,
            )
        )
    else:
        print(text)

    _warn_unpriced(records, config)
    return 0


def _pick_sources(values: list[str] | None) -> list[str]:
    if not values:
        return list(SOURCE_ORDER)
    picked: list[str] = []
    for value in values:
        for item in value.split(","):
            name = item.strip().lower()
            if not name:
                continue
            if name not in SOURCE_ORDER:
                raise UsageError(f"未知来源 {name}，可选 {'、'.join(SOURCE_ORDER)}")
            if name not in picked:
                picked.append(name)
    return picked or list(SOURCE_ORDER)


def _range(args, book: PriceBook) -> tuple[date | None, date | None]:
    since = _day(getattr(args, "since", None))
    until = _day(getattr(args, "until", None))
    today = datetime.now(book.tz).date()

    if getattr(args, "all", False):
        return since, until
    days = getattr(args, "days", None)
    if days is not None:
        if days < 1:
            raise UsageError("--days 至少为 1")
        return today - timedelta(days=days - 1), today
    if since is None and until is None:
        return today - timedelta(days=13), today
    return since, until


def _day(text: str | None) -> date | None:
    if not text:
        return None
    try:
        return date.fromisoformat(text)
    except ValueError as exc:
        raise UsageError(f"日期 {text} 不是 YYYY-MM-DD") from exc


def _in_range(at: datetime, book: PriceBook, since: date | None, until: date | None) -> bool:
    day = at.astimezone(book.tz).date()
    if since is not None and day < since:
        return False
    if until is not None and day > until:
        return False
    return True


def _warn_unpriced(records, config: Config) -> None:
    unknown = sorted(
        {record.model or "未知" for record in records if config.book.price_for(record.model) is None}
    )
    if not unknown:
        return
    where = config.path
    hint = f"补进 {where}" if where else "在 ~/.config/tokx/config.toml 里补上价格"
    print(
        f"tokx: 这些模型没有价格，费用未计入: {', '.join(unknown)}；{hint}",
        file=sys.stderr,
    )


def _print_prices(book: PriceBook, as_json: bool) -> int:
    if not as_json:
        print(report.table_prices(book))
        return 0
    models = {}
    for name, price in sorted(book.models.items()):
        if price.free:
            models[name] = {"free": True}
        else:
            models[name] = {
                "free": False,
                "off": {"hit": price.off.hit, "miss": price.off.miss, "output": price.off.output},
                "peak": {"hit": price.peak.hit, "miss": price.peak.miss, "output": price.peak.output},
            }
    print(
        json.dumps(
            {
                "currency": "CNY",
                "unit": "per_million_tokens",
                "timezone": str(book.tz),
                "peak_windows": [
                    f"{start.strftime('%H:%M')}-{end.strftime('%H:%M')}" for start, end in book.windows
                ],
                "weekdays": sorted(book.weekdays),
                "holidays": [day.isoformat() for day in sorted(book.holidays)],
                "models": models,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0
