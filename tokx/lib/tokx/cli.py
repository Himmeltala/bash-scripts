"""命令行入口：参数解析、数据汇总与输出。"""

from __future__ import annotations

import argparse
import copy
import io
import json
import os
import re
import select
import sys
import termios
import time
from datetime import date, datetime, timedelta

from . import report
from .config import Config, ConfigError, load
from .model import Record
from .pricing import PriceBook
from .snapshot import Snapshot
from .sources import SOURCE_LABELS, SOURCE_ORDER, SourceError, collect
from .store import Store, StoreError

VERSION = "0.2.0"
COMMANDS = ("daily", "session", "hour", "prices", "rebuild", "db", "web")

# --watch 不带秒数时多久刷一次。
WATCH_SECONDS = 5
# 算宽度前先去掉 ANSI 颜色序列。
_ESCAPE = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]")


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
    _add_watch(parser)

    sub = parser.add_subparsers(dest="command", metavar="命令")
    suppressed = argparse.ArgumentParser(add_help=False)
    _add_common(suppressed, suppress=True)
    for name, text in (
        ("daily", "按天汇总，默认命令"),
        ("session", "按会话汇总"),
        ("hour", "按一天内的小时分布汇总"),
        ("prices", "打印当前价格表"),
        ("rebuild", "清空账本后全量重扫并重建"),
        ("web", "在浏览器里看用量，定时自动刷新"),
    ):
        child = sub.add_parser(name, parents=[suppressed], help=text, description=text)
        if name in ("daily", "session", "hour"):
            _add_watch(child, suppress=True)
        if name == "web":
            _add_web(child)

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


def _fold_watch(argv: list[str]) -> list[str]:
    """"--watch 3" 收成 "--watch=3"，"--watch" 后面不是秒数就原样留着。"""
    out: list[str] = []
    index = 0
    while index < len(argv):
        item = argv[index]
        if item == "--watch" and index + 1 < len(argv):
            nxt = argv[index + 1]
            try:
                float(nxt)
            except ValueError:
                pass
            else:
                out.append(f"--watch={nxt}")
                index += 2
                continue
        out.append(item)
        index += 1
    return out


def _top_values(argv: list[str]) -> dict[str, object]:
    """只按主命令那张选项表解析前缀，取子命令前面的 -s、--days、--watch 等。"""
    parser = argparse.ArgumentParser(add_help=False)
    _add_common(parser, suppress=False)
    _add_watch(parser)
    try:
        found, _ = parser.parse_known_args(argv)
    except SystemExit:
        return {}
    return {key: value for key, value in vars(found).items() if key != "command"}


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


def _add_watch(parser: argparse.ArgumentParser, suppress: bool = False) -> None:
    # 秒数是可选的，写成 "--watch 3"；可选的取值会吞掉紧跟的子命令，
    # 所以 main() 里先把 "--watch" 后面的数字换成 "--watch=N" 再解析。
    extra = {"default": argparse.SUPPRESS} if suppress else {}
    parser.add_argument(
        "--watch",
        nargs="?",
        const=str(WATCH_SECONDS),
        metavar="秒",
        help=f"每 N 秒原地刷新一次，默认 {WATCH_SECONDS} 秒，按 q 或 Ctrl+C 退出",
        **extra,
    )


def _add_web(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--host",
        default="0.0.0.0",
        metavar="地址",
        help="监听地址，默认 0.0.0.0，同网络的机器都能访问；只想本机看用 --host 127.0.0.1",
    )
    parser.add_argument("--port", type=int, default=0, metavar="端口", help="监听端口，默认 0 由系统挑一个空闲的")
    parser.add_argument("--open", action="store_true", help="启动后打开默认浏览器")


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    argv = list(sys.argv[1:] if argv is None else argv)
    # "--watch 3" 里的 3 收成 "--watch=3"，否则可选的秒数会把紧跟的子命令吞掉。
    argv = _fold_watch(argv)
    args = parser.parse_args(argv)
    command = getattr(args, "command", None) or "daily"
    if command in ("daily", "session", "hour", "prices", "rebuild"):
        # 选项写在子命令前面时（tokx --watch 3 daily），argparse 会把它们记在一张空白的
        # 子命令命名空间上，子命令那份是空的，这里把前面那份补过来。两个都写了时子命令的优先。
        top = _top_values(argv)
        for field, value in top.items():
            if not hasattr(args, field):
                setattr(args, field, value)
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
    if command == "web":
        return _web_command(args, config)

    try:
        since, until = _range(args, config.book)
    except UsageError as exc:
        print(f"tokx: {exc}", file=sys.stderr)
        return 2

    if command == "rebuild":
        return _rebuild(args, config, since, until)

    if _watching(args):
        try:
            seconds = _watch_seconds(args)
        except UsageError as exc:
            print(f"tokx: {exc}", file=sys.stderr)
            return 2
        if getattr(args, "json", False):
            print("tokx: --watch 只有表格，不能和 --json 一起用", file=sys.stderr)
            return 2
        return _watch(command, args, config, since, until, seconds)

    return _report_command(command, args, config, since, until)


def _web_command(args: argparse.Namespace, config: Config) -> int:
    from . import web

    try:
        host = web.parse_host(args.host)
        if args.port < 0 or args.port > 65535:
            raise UsageError("--port 取 0 到 65535")
        # stdout 接了管道时地址行会被读走，服务却还开着；--json 就是给脚本起服务用的。
        if not getattr(args, "json", False) and not sys.stdout.isatty():
            raise UsageError("输出没接终端时用 tokx web --json 打出地址，别接管道")
    except UsageError as exc:
        print(f"tokx: {exc}", file=sys.stderr)
        return 2
    return web.serve(config, host=host, port=args.port, open_browser=args.open, as_json=getattr(args, "json", False))


def _collect(
    command: str,
    args: argparse.Namespace,
    config: Config,
    since: date | None,
    until: date | None,
) -> dict:
    """一次出表要的全部数据：本次范围的记录、聚合好的行与合计、未计价模型。

    --json 和网页界面都拿这份结构，行里的字段直接就是 JSON 里的字段。
    """
    sources = _pick_sources(getattr(args, "source", None))

    records, batches, snapshots = _scan(config, sources)
    _remember(config, batches, snapshots)

    recalled = _recall(config, sources, batches)
    kept, recalled = _trim(config, recalled, since, until)
    if kept:
        _forget(config, kept)

    records = [record for record in records if _in_range(record.at, config.book, since, until)]
    # 回显的记录同样按范围筛：跨天会话只留范围内的行，免得昨天的请求混进今天的报表。
    records.extend(record for record in recalled if _in_range(record.at, config.book, since, until))
    for record in records:
        record.api = config.api.address(record.source, record.provider)
    records.sort(key=lambda record: record.at)

    book = config.book
    unpriced = _unpriced_models(records, book)
    if command == "session":
        rows, total = report.sessions(records, book)
    elif command == "hour":
        rows, total = report.hours(records, book)
    else:
        rows, total = report.daily(records, book)
    return {
        "command": command,
        "since": since.isoformat() if since else None,
        "until": until.isoformat() if until else None,
        "timezone": str(book.tz),
        "currency": "CNY",
        "unpriced_models": unpriced,
        "rows": rows,
        "totals": total,
    }


def _report_command(
    command: str,
    args: argparse.Namespace,
    config: Config,
    since: date | None,
    until: date | None,
    out: object | None = None,
) -> int:
    """出一张表。out 给定时写进它，用于 --watch 和网页界面取表格文本，否则直接打印。"""
    try:
        data = _collect(command, args, config, since, until)
    except UsageError as exc:
        print(f"tokx: {exc}", file=sys.stderr)
        return 2

    if not data["rows"]:
        print("没有找到用量记录。", file=out or sys.stderr)
        return 0
    book = config.book
    rows, total, unpriced = data["rows"], data["totals"], data["unpriced_models"]
    if command == "session":
        text = report.table_sessions(rows, total, unpriced)
    elif command == "hour":
        text = report.table_hours(rows, total, unpriced)
    else:
        text = report.table_daily(rows, total, unpriced)

    if getattr(args, "json", False):
        print(json.dumps(data, ensure_ascii=False, indent=2), file=out or sys.stdout)
    else:
        print(text, file=out or sys.stdout)
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


def _watching(args: argparse.Namespace) -> bool:
    return getattr(args, "watch", None) is not None


def _watch_seconds(args: argparse.Namespace) -> float:
    raw = getattr(args, "watch", None)
    try:
        seconds = float(raw if raw is not None else WATCH_SECONDS)
    except (TypeError, ValueError) as exc:
        raise UsageError(f"--watch 的秒数 {raw} 不是数字") from exc
    if seconds < 1:
        raise UsageError("--watch 的秒数至少为 1")
    return seconds


def _split_table(text: str) -> tuple[list[str], list[str], int]:
    """把一张表拆成表头（含分隔行）、数据行、表下说明，数据行不含合计。"""
    lines = text.splitlines()
    sep = next((index for index, line in enumerate(lines[1:], 1) if line.startswith("---")), None)
    if sep is None:
        return lines, [], 0
    head = lines[: sep + 1]
    body: list[str] = []
    for index in range(sep + 1, len(lines)):
        line = lines[index]
        if not line.strip() or line.startswith("合计"):
            return head, body, index
        body.append(line)
    return head, body, len(lines)


def _view(text: str, cols: int, rows: int, book: PriceBook) -> list[str]:
    """按终端宽高裁表：先砍数据行，只留表头和最近的几行，放不下的宽度从中间丢掉。"""
    head, body, tail_at = _split_table(text)
    rest = text.splitlines()[tail_at:]
    room = max(rows - len(head) - 1, 1)
    if len(body) + 1 > room:
        shown = max(room - 1, 0)
        lines = head + body[:shown] + [f"… 另有 {len(body) - shown} 行未显示，把终端拉高或缩小日期范围"]
    else:
        lines = head + body
    if tail_at:
        lines += [""] + rest
    if cols > 0:
        need = _columns(head[0])
        if need > cols + 40:
            # 比终端宽出太多，缩排也认不出是哪几列，直接说清楚要多少列。
            lines = [f"终端太窄：表格要 {need} 列，窗口只有 {cols} 列，拉宽窗口或换一张窄表"]
        else:
            lines = [_narrow(line, cols) for line in lines]
    return lines


def _narrow(line: str, cols: int) -> str:
    """从模型和 API 地址那一段中间丢字，两头的关键列保留，免得终端折行打乱重画。"""
    width = _columns(line)
    if width <= cols:
        return line
    cells = re.split(r"(  +)", line)
    # cells 形如 [单元, 空白, 单元, 空白, ...]，偶数位是列内容。
    body = [index for index in range(0, len(cells), 2) if len(cells[index]) > 24]
    for index in body:
        over = width - cols
        cell = cells[index]
        width_cell = _columns(cell)
        keep_total = max(width_cell - over - 1, 8)
        left = keep_total * 2 // 3
        cells[index] = cell[:left] + "…" + cell[len(cell) - (keep_total - left) :]
        width = _columns("".join(cells))
        if width <= cols:
            break
    result = "".join(cells)
    return result if _columns(result) <= cols else result[: max(cols - 1, 1)] + "…"


def _columns(line: str) -> int:
    """去掉颜色控制再按显示宽度算，免得转义序列被当成字算宽。"""
    return report.display_width(_ESCAPE.sub("", line))


def _watch(
    command: str,
    args: argparse.Namespace,
    config: Config,
    since: date | None,
    until: date | None,
    seconds: float,
) -> int:
    """原地刷新：表格画在终端上，隔一段时间重画一次，不再每次往下面追一份。"""
    if not sys.stdout.isatty():
        frames = os.environ.get("TOKX_WATCH_FRAMES", "").strip()
        return _watch_frames(command, args, config, since, until, seconds, frames)

    try:
        saved = termios.tcgetattr(sys.stdin.fileno())
    except (OSError, termios.error):
        saved = None
        print("tokx: 读不了键盘，按 Ctrl+C 退出", file=sys.stderr)
    try:
        if saved is not None:
            raw = copy.deepcopy(saved)
            raw[3] &= ~(termios.ICANON | termios.ECHO)
            raw[6][termios.VMIN] = 0
            raw[6][termios.VTIME] = 0
            termios.tcsetattr(sys.stdin.fileno(), termios.TCSADRAIN, raw)
        sys.stdout.write("\x1b[H")
        sys.stdout.flush()
        return _watch_loop(command, args, config, since, until, seconds, saved is not None)
    except KeyboardInterrupt:
        return 0
    finally:
        if saved is not None:
            termios.tcsetattr(sys.stdin.fileno(), termios.TCSADRAIN, saved)
        sys.stdout.write("\x1b[J\x1b[H\r\n")
        sys.stdout.flush()


def _watch_loop(
    command: str,
    args: argparse.Namespace,
    config: Config,
    since: date | None,
    until: date | None,
    seconds: float,
    keyboard: bool,
) -> int:
    """刷新主循环：到点重扫重画，中间那点空闲用来等按键；按 q 或 Ctrl+C 返回 0。"""
    drawn: list[str] = []
    next_at = time.monotonic()
    while True:
        now = time.monotonic()
        if now < next_at:
            if keyboard and _pause(min(next_at - now, seconds)):
                return 0
            continue
        next_at = now + seconds
        text = _frame(command, args, config, since, until, seconds)
        try:
            size = os.get_terminal_size(sys.stdout.fileno())
        except OSError:
            size = os.terminal_size((0, 0))
        lines = _view(text, size.columns, size.lines - 1, config.book)
        if lines != drawn:
            drawn = lines
            # 每帧都把光标下面的旧内容清掉再回到左上角，免得上一帧更长的行留在屏幕上。
            sys.stdout.write("\r\n".join(lines) + "\x1b[J\x1b[H")
            sys.stdout.flush()
        if keyboard and _pause(min(next_at - time.monotonic(), seconds)):
            return 0


def _pause(seconds: float) -> bool:
    """等一会儿，期间按到 q 或 Ctrl+C 就返回 True。"""
    if not sys.stdin.readable():
        if seconds > 0:
            time.sleep(seconds)
        return False
    try:
        ready, _, _ = select.select([sys.stdin], [], [], max(seconds, 0.0))
    except (OSError, ValueError):
        return False
    if not ready:
        return False
    key = os.read(sys.stdin.fileno(), 1)
    return key in (b"q", b"Q", b"\x03")


def _watch_frames(
    command: str,
    args: argparse.Namespace,
    config: Config,
    since: date | None,
    until: date | None,
    seconds: float,
    frames: str,
) -> int:
    """没有终端时为了能测，按 TOKX_WATCH_FRAMES 连出几帧就退出。输出的是整帧文本，不是增量。"""
    try:
        count = int(frames)
    except ValueError:
        count = 0
    if count < 1:
        print("tokx: --watch 没有终端，用 | cat 之类的管道就用普通输出", file=sys.stderr)
        return 2
    for index in range(count):
        if index:
            time.sleep(seconds)
        print(_frame(command, args, config, since, until, seconds))
    return 0


def _frame(
    command: str,
    args: argparse.Namespace,
    config: Config,
    since: date | None,
    until: date | None,
    seconds: float,
) -> str:
    """一次刷新：重新现扫、导入账本、出表，并带上这次刷新的时间。"""
    buffer = io.StringIO()
    _report_command(command, args, config, since, until, buffer)
    stamp = datetime.now(config.book.tz).strftime("%Y-%m-%d %H:%M:%S")
    note = f"刷新于 {stamp}，每 {seconds:g} 秒一次，按 q 或 Ctrl+C 退出"
    if not config.store.enabled:
        note += "（关闭账本）"
    text = buffer.getvalue().rstrip()
    return f"{text}\n\n{note}" if text else note


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
        if _watching(args):
            # 全量摊到终端里放不下，看全量就再跑一次 tokx --all 翻屏看。
            raise UsageError("--all 配合 --watch 会把整张表塞进一屏，去掉 --all 或改成 --days N")
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


def _price_data(book: PriceBook) -> dict:
    """价格表的 JSON 形态，--json 与网页界面共用。"""
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
    return {
        "currency": "CNY",
        "unit": "per_million_tokens",
        "timezone": str(book.tz),
        "peak_windows": [
            f"{start.strftime('%H:%M')}-{end.strftime('%H:%M')}" for start, end in book.windows
        ],
        "weekdays": sorted(book.weekdays),
        "holidays": [day.isoformat() for day in sorted(book.holidays)],
        "models": models,
    }


def _print_prices(book: PriceBook, as_json: bool) -> int:
    if not as_json:
        print(report.table_prices(book))
        return 0
    print(json.dumps(_price_data(book), ensure_ascii=False, indent=2))
    return 0
