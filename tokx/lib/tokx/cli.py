"""命令行入口：参数解析、数据汇总与输出。"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime, timedelta

from . import report
from .config import Config, ConfigError, load
from .model import Record
from .pricing import PriceBook
from .snapshot import Snapshot
from .sources import SOURCE_LABELS, SOURCE_ORDER, SourceError, collect
from .store import Store, StoreError

VERSION = "0.2.0"
COMMANDS = ("daily", "session", "hour", "prices", "rebuild", "db")


class UsageError(Exception):
    """参数写错时抛出，打印消息后以 2 退出。"""


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="tokx",
        description="统计 Claude Code、opencode、DeepSeek Harness 的 token 用量与费用，按 DeepSeek 峰谷价与 mimo 实时价计费。",
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
        ("rebuild", "清空账本后全量重扫并重建"),
    ):
        sub.add_parser(name, parents=[suppressed], help=text, description=text)

    db = sub.add_parser("db", help="查看与维护用量账本", description="查看与维护用量账本")
    db.add_argument(
        "action",
        choices=("import", "status", "gc"),
        help="import 采集并写入账本；status 看账本概况；gc 清理过期记录",
    )
    db.add_argument(
        "--keep-days",
        type=int,
        metavar="N",
        help="gc 时保留最近多少天，默认取配置里的 store.keep_days",
    )
    db.add_argument("--json", action="store_true", help="输出 JSON")
    db.add_argument("--config", metavar="路径", help="指定配置文件")
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
    if command == "db":
        return _db_command(args, config)

    try:
        since, until = _range(args, config.book)
    except UsageError as exc:
        print(f"tokx: {exc}", file=sys.stderr)
        return 2

    if command == "rebuild":
        return _rebuild(args, config, since, until)

    return _report_command(command, args, config, since, until)


def _report_command(
    command: str,
    args: argparse.Namespace,
    config: Config,
    since: date | None,
    until: date | None,
) -> int:
    try:
        sources = _pick_sources(getattr(args, "source", None))
    except UsageError as exc:
        print(f"tokx: {exc}", file=sys.stderr)
        return 2

    records, batches, snapshots = _scan(config, sources)
    _remember(config, batches, snapshots)

    recalled = _recall(config, sources, batches)
    kept, recalled = _trim(config, recalled, since, until)
    if kept:
        _forget(config, kept)

    records = [record for record in records if _in_range(record.at, config.book, since, until)]
    records.extend(recalled)
    for record in records:
        record.api = config.api.address(record.source, record.provider)
    records.sort(key=lambda record: record.at)

    if not records:
        print("没有找到用量记录。", file=sys.stderr)
        return 0

    book = config.book
    unpriced = _unpriced_models(records, book)
    if command == "session":
        rows, total = report.sessions(records, book)
        text = report.table_sessions(rows, total, unpriced)
    elif command == "hour":
        rows, total = report.hours(records, book)
        text = report.table_hours(rows, total, unpriced)
    else:
        rows, total = report.daily(records, book)
        text = report.table_daily(rows, total, unpriced)

    if getattr(args, "json", False):
        print(
            json.dumps(
                {
                    "command": command,
                    "since": since.isoformat() if since else None,
                    "until": until.isoformat() if until else None,
                    "timezone": str(book.tz),
                    "currency": "CNY",
                    "unpriced_models": unpriced,
                    "rows": rows,
                    "totals": total,
                },
                ensure_ascii=False,
                indent=2,
            )
        )
    else:
        print(text)

    return 0


def _scan(config: Config, sources: list[str]):
    """现扫三个来源，顺手把现扫结果存进快照缓存。

    返回 (记录, {来源: {会话: [记录]}}, {来源: 快照})。
    """
    records: list[Record] = []
    batches: dict[str, dict[str, list[Record]]] = {}
    snapshots: dict[str, Snapshot] = {}
    for source in sources:
        snapshot = None
        if config.store.enabled:
            snapshot = Snapshot(source, config.store.cache_dir / f"{source}.json")
            snapshots[source] = snapshot
        try:
            found = collect(source, config.paths, snapshot)
        except (SourceError, OSError) as exc:
            print(f"tokx: 跳过 {SOURCE_LABELS[source]}: {exc}", file=sys.stderr)
            found = []
        records.extend(found)
        batches[source] = _by_session(found)
    return records, batches, snapshots


def _by_session(records: list[Record]) -> dict[str, list[Record]]:
    grouped: dict[str, list[Record]] = {}
    for record in records:
        grouped.setdefault(record.session, []).append(record)
    return grouped


def _remember(
    config: Config,
    batches: dict[str, dict[str, list[Record]]],
    snapshots: dict[str, Snapshot],
) -> None:
    """把现扫结果写进账本，并把快照缓存落盘；账本写不进去只警告，不影响出表。"""
    for snapshot in snapshots.values():
        snapshot.save()
    if not config.store.enabled or not batches:
        return
    try:
        with Store(config.store.db, config.book.tz) as store:
            store.insert(batches)
    except StoreError as exc:
        print(f"tokx: {exc}（本次只显示现扫结果）", file=sys.stderr)


def _recall(config: Config, sources: list[str], batches: dict[str, dict[str, list[Record]]]) -> list[Record]:
    """账本里有、这次没扫到的会话，把它们的记录读回来补进报表。"""
    if not config.store.enabled:
        return []
    try:
        with Store(config.store.db, config.book.tz) as store:
            known = store.sessions(sources)
            old = {key for key in known if key[1] not in batches.get(key[0], {})}
            if not old:
                return []
            records = [record for record in store.records(sources) if (record.source, record.session) in old]
    except StoreError as exc:
        print(f"tokx: {exc}", file=sys.stderr)
        return []
    for record in records:
        record.origin = report.ORIGIN_CACHE
    return records


def _trim(
    config: Config,
    records: list[Record],
    since: date | None,
    until: date | None,
) -> tuple[list[tuple[str, str]], list[Record]]:
    """日期范围完全落在账本记录之外的会话，账本里的记录留着没用了，返回要清理的会话。"""
    if not config.store.enabled or not records:
        return [], records
    span: dict[tuple[str, str], tuple[date, date]] = {}
    for record in records:
        day = record.at.astimezone(config.book.tz).date()
        key = (record.source, record.session)
        low, high = span.get(key, (day, day))
        span[key] = (min(low, day), max(high, day))
    drop = {
        key
        for key, (low, high) in span.items()
        if (since is not None and high < since) or (until is not None and low > until)
    }
    if not drop:
        return [], records
    return list(drop), [record for record in records if (record.source, record.session) not in drop]


def _forget(config: Config, sessions: list[tuple[str, str]]) -> None:
    try:
        with Store(config.store.db, config.book.tz) as store:
            store.forget(sessions)
    except StoreError as exc:
        print(f"tokx: {exc}", file=sys.stderr)


def _rebuild(
    args: argparse.Namespace,
    config: Config,
    since: date | None,
    until: date | None,
) -> int:
    """清空账本后按当前采集口径全量重扫，改了口径或时区之后用。"""
    try:
        sources = _pick_sources(getattr(args, "source", None))
    except UsageError as exc:
        print(f"tokx: {exc}", file=sys.stderr)
        return 2
    if not config.store.enabled:
        print("tokx: 配置里 store.enabled 是 false，账本没在用", file=sys.stderr)
        return 2

    records, batches, snapshots = _scan(config, sources)
    for snapshot in snapshots.values():
        snapshot.save()
    records = [record for record in records if _in_range(record.at, config.book, since, until)]
    try:
        with Store(config.store.db, config.book.tz) as store:
            store.clear(sources)
            added = store.insert(batches)
    except StoreError as exc:
        print(f"tokx: {exc}", file=sys.stderr)
        return 1

    print(f"账本已重建：{len(records)} 条请求，写入 {added} 行，{config.store.db}")
    return 0


def _db_command(args: argparse.Namespace, config: Config) -> int:
    if not config.store.enabled:
        print("tokx: 配置里 store.enabled 是 false，账本没在用", file=sys.stderr)
        return 2
    try:
        if args.action == "import":
            return _db_import(config, bool(args.json))
        if args.action == "gc":
            return _db_gc(config, args.keep_days, bool(args.json))
        return _db_status(config, bool(args.json))
    except (StoreError, UsageError) as exc:
        print(f"tokx: {exc}", file=sys.stderr)
        return 1


def _db_import(config: Config, as_json: bool) -> int:
    """采集并入库，给 SessionEnd 之类的外部钩子调用，不出报表。"""
    records, batches, snapshots = _scan(config, list(SOURCE_ORDER))
    for snapshot in snapshots.values():
        snapshot.save()
    with Store(config.store.db, config.book.tz) as store:
        added = store.insert(batches)
    if as_json:
        print(
            json.dumps(
                {"action": "import", "records": len(records), "added": added},
                ensure_ascii=False,
                indent=2,
            )
        )
    else:
        print(f"账本导入完成：现扫 {len(records)} 条请求，新增 {added} 行")
    return 0


def _db_gc(config: Config, keep_days: int | None, as_json: bool) -> int:
    days = keep_days if keep_days is not None else config.store.keep_days
    if days < 1:
        raise UsageError("--keep-days 至少为 1")
    with Store(config.store.db, config.book.tz) as store:
        stale = store.stale(list(SOURCE_ORDER), days)
        removed = store.forget(stale)
    if as_json:
        print(
            json.dumps(
                {"action": "gc", "keep_days": days, "sessions": len(stale), "removed": removed},
                ensure_ascii=False,
                indent=2,
            )
        )
    else:
        print(f"清理完成：{days} 天内没再出现的会话 {len(stale)} 个，删除 {removed} 行")
    return 0


def _db_status(config: Config, as_json: bool) -> int:
    with Store(config.store.db, config.book.tz) as store:
        stats = store.stats()
    if as_json:
        print(json.dumps(stats, ensure_ascii=False, indent=2))
        return 0
    if not stats["requests"]:
        print(f"账本还是空的：{stats['path']}")
        return 0
    lines = [
        f"账本      {stats['path']}",
        f"请求      {stats['requests']:,} 条，{stats['sessions']} 个会话",
        f"时间范围  {stats['first_at']} 至 {stats['last_at']}",
    ]
    for item in stats["sources"]:
        label = SOURCE_LABELS.get(item["source"], item["source"])
        lines.append(f"  {label}：{item['requests']:,} 条，{item['sessions']} 个会话")
    print("\n".join(lines))
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


def _unpriced_models(records, book: PriceBook) -> list[str]:
    """表里查不到价格的模型名，按字母序去重，用来在表下说明 -- 的含义。"""
    return sorted(
        {
            book.resolve(record.model) or "未知"
            for record in records
            if book.price_for(record.model) is None
        }
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
