"""加载配置与三个数据源的位置。"""

from __future__ import annotations

import os
import sys
import tomllib
from dataclasses import dataclass
from datetime import date, time
from pathlib import Path
from zoneinfo import ZoneInfo

# 共用小件在仓库根的 lib/py-shared 下，源码与安装后的相对层级一致。
sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "lib" / "py-shared"))
from tomlout import Inline, dumps

from .api import ApiBook
from .pricing import (
    DEFAULT_ALIASES,
    DEFAULT_MODELS,
    DEFAULT_TZ,
    DEFAULT_WEEKDAYS,
    DEFAULT_WINDOWS,
    ModelPrice,
    PriceBook,
    Tier,
    ZERO_TIER,
)


class ConfigError(Exception):
    """配置文件写错时抛出，消息直接展示给用户。"""


@dataclass(slots=True)
class Paths:
    claude: Path
    opencode: Path
    opencode_config: Path
    dsh_sessions: Path
    state: Path
    profiles: Path
    backups: Path
    garbage: Path


@dataclass(slots=True)
class Config:
    book: PriceBook
    paths: Paths
    api: ApiBook
    store: StoreConfig
    path: Path | None


@dataclass(frozen=True, slots=True)
class StoreConfig:
    """账本与现扫缓存的位置；关掉以后退回纯现扫，行为与没有账本时一致。"""

    enabled: bool
    db: Path
    cache_dir: Path
    keep_days: int


def config_path(explicit: str | None = None) -> Path:
    """价格配置的位置：与 nodex、mvnx 一样放在缓存目录，页面与命令行读写同一份。"""
    if explicit:
        return Path(explicit).expanduser()
    if os.environ.get("LLMX_CONFIG"):
        return Path(os.environ["LLMX_CONFIG"]).expanduser()
    base = Path(os.environ.get("XDG_CACHE_HOME", "~/.cache")).expanduser()
    return base / "llmx" / "config.toml"


def _tier(table: object, where: str) -> Tier:
    if not isinstance(table, dict):
        raise ConfigError(f"{where} 需要写成 {{ hit = ..., miss = ..., output = ... }}")
    try:
        return Tier(
            hit=float(table.get("hit", 0.0)),
            miss=float(table.get("miss", 0.0)),
            output=float(table.get("output", 0.0)),
        )
    except (TypeError, ValueError) as exc:
        raise ConfigError(f"{where} 的价格不是数字: {exc}") from exc


def _model_price(spec: object, name: str) -> ModelPrice:
    if not isinstance(spec, dict):
        raise ConfigError(f"models.{name} 需要写成表")
    if spec.get("free"):
        return ModelPrice(off=ZERO_TIER, peak=ZERO_TIER, free=True)
    if "off" not in spec or "peak" not in spec:
        raise ConfigError(f"models.{name} 缺少 off 或 peak；免费模型写 free = true")
    return ModelPrice(
        off=_tier(spec["off"], f"models.{name}.off"),
        peak=_tier(spec["peak"], f"models.{name}.peak"),
    )


def _state_dir(home: Path) -> Path:
    """账本、配置档、备份与回收站的位置，与 nodex、mvnx 一样落在缓存目录下。"""
    if os.environ.get("LLMX_STATE_DIR"):
        return Path(os.environ["LLMX_STATE_DIR"]).expanduser()
    base = Path(os.environ.get("XDG_CACHE_HOME", home / ".cache")).expanduser()
    return base / "llmx"


def _store(table: object, home: Path) -> StoreConfig:
    if not isinstance(table, dict):
        raise ConfigError("store 需要写成表")
    enabled = table.get("enabled", True)
    if not isinstance(enabled, bool):
        raise ConfigError("store.enabled 需要写成 true 或 false")
    try:
        keep_days = int(table.get("keep_days", 180))
    except (TypeError, ValueError) as exc:
        raise ConfigError("store.keep_days 需要写成整数天数") from exc
    if keep_days < 1:
        raise ConfigError("store.keep_days 至少为 1")
    # 与 nodex、mvnx 同在一个缓存目录下，路径由 _state_dir 给出。
    state_dir = _state_dir(home)
    db = Path(str(table.get("db") or state_dir / "usage.db")).expanduser()
    cache_dir = Path(str(table.get("cache_dir") or state_dir / "cache")).expanduser()
    return StoreConfig(enabled=enabled, db=db, cache_dir=cache_dir, keep_days=keep_days)


def _parse_window(text: str) -> tuple[time, time]:
    try:
        left, right = text.split("-", 1)
        return time.fromisoformat(left.strip()), time.fromisoformat(right.strip())
    except ValueError as exc:
        raise ConfigError(f"peak.windows 里的 {text!r} 不是 HH:MM-HH:MM") from exc


def _parse_holidays(values: object) -> frozenset[date]:
    if not isinstance(values, list):
        raise ConfigError("peak.holidays 需要写成日期列表")
    days: set[date] = set()
    for value in values:
        try:
            days.add(date.fromisoformat(str(value)))
        except ValueError as exc:
            raise ConfigError(f"peak.holidays 里的 {value!r} 不是 YYYY-MM-DD") from exc
    return frozenset(days)


HEADER = """\
# llmx 配置：模型单价按元每百万 token 计，是 DeepSeek 与 mimo 的官方价。
# off 是空闲价，peak 是高峰价；不分峰谷的模型两档写一样的数。
# 免费模型写 free = true，只统计 token，费用记 0。
# 节假日每年安排不同，按 YYYY-MM-DD 补进 [peak].holidays。"""


def _table(doc: dict, name: str) -> dict:
    """取配置里的一节；没写算空表，写成了别的类型直接报错。"""
    value = doc.get(name)
    if value is None:
        return {}
    if not isinstance(value, dict):
        raise ConfigError(f"{name} 需要写成表")
    return value


def _book(doc: dict) -> PriceBook:
    """文档里的价格部分翻成价格表；配置文本校验与出表共用这一套规则。"""
    models = dict(DEFAULT_MODELS)
    for name, spec in _table(doc, "models").items():
        models[name] = _model_price(spec, name)

    aliases = dict(DEFAULT_ALIASES)
    for old, new in _table(doc, "aliases").items():
        aliases[str(old)] = str(new)

    peak = _table(doc, "peak")
    tz_name = str(peak.get("timezone", DEFAULT_TZ))
    try:
        tz = ZoneInfo(tz_name)
    except Exception as exc:  # zoneinfo 的异常类型随 Python 版本变化
        raise ConfigError(f"peak.timezone 无效: {tz_name}") from exc

    windows = DEFAULT_WINDOWS
    if "windows" in peak:
        windows = tuple(_parse_window(str(item)) for item in peak["windows"])
    weekdays = DEFAULT_WEEKDAYS
    if "weekdays" in peak:
        try:
            weekdays = frozenset(int(item) for item in peak["weekdays"])
        except (TypeError, ValueError) as exc:
            raise ConfigError("peak.weekdays 需要写成 0 到 6 的整数列表") from exc
        if any(day < 0 or day > 6 for day in weekdays):
            raise ConfigError("peak.weekdays 需要写成 0 到 6 的整数列表")

    holidays = _parse_holidays(peak.get("holidays", []))
    return PriceBook(
        models=models,
        aliases=aliases,
        windows=windows,
        weekdays=weekdays,
        holidays=holidays,
        tz=tz,
    )


def _apis(doc: dict) -> dict[str, str]:
    apis: dict[str, str] = {}
    for name, value in _table(doc, "apis").items():
        if not isinstance(value, str):
            raise ConfigError(f"apis.{name} 需要写成地址字符串")
        apis[str(name)] = value
    return apis


def parse_text(text: str) -> dict:
    """配置文本 → 原始文档；语法有错就抛 ConfigError。"""
    try:
        return tomllib.loads(text)
    except tomllib.TOMLDecodeError as exc:
        raise ConfigError(f"TOML 语法有错：{exc}") from exc


def load_from_text(text: str) -> PriceBook:
    """配置文本 → 价格表，不碰任何文件；网页校验与测试用。"""
    return _book(parse_text(text))


def validate_text(text: str) -> None:
    """保存前把整份文本按加载时的规则走一遍，免得写进去的配置让下次读取失败。"""
    doc = parse_text(text)
    _book(doc)
    _store(_table(doc, "store"), Path.home())
    _apis(doc)


def render(book: PriceBook) -> str:
    """把当前价格表写成带说明的配置文本；网页里还没有配置文件时先给这一份。"""
    models = {}
    for name, price in book.models.items():
        if price.free:
            models[name] = {"free": True}
        else:
            models[name] = {
                "off": Inline(hit=price.off.hit, miss=price.off.miss, output=price.off.output),
                "peak": Inline(hit=price.peak.hit, miss=price.peak.miss, output=price.peak.output),
            }
    peak = {
        "timezone": str(book.tz),
        "windows": [
            "%s-%s" % (start.strftime("%H:%M"), end.strftime("%H:%M"))
            for start, end in book.windows
        ],
        "weekdays": sorted(book.weekdays),
        "holidays": [day.isoformat() for day in sorted(book.holidays)],
    }
    parts = [
        HEADER,
        dumps({"models": models}),
        dumps({"aliases": dict(book.aliases)}),
        dumps({"peak": peak}),
    ]
    return "\n\n".join(part.strip("\n") for part in parts if part.strip("\n")) + "\n"


def load(explicit: str | None = None) -> Config:
    path = config_path(explicit)
    doc: dict = {}
    if explicit and not path.is_file():
        raise ConfigError(f"找不到配置文件 {path}")
    if path.is_file():
        try:
            text = path.read_text(encoding="utf-8")
        except OSError as exc:
            raise ConfigError(f"读取 {path} 失败: {exc}") from exc
        try:
            doc = parse_text(text)
        except ConfigError as exc:
            raise ConfigError(f"读取 {path} 失败: {exc}") from exc

    book = _book(doc)
    store = _store(_table(doc, "store"), Path.home())
    apis = _apis(doc)

    home = Path.home()
    config_home = Path(os.environ.get("XDG_CONFIG_HOME", home / ".config")).expanduser()
    state = _state_dir(home)
    paths = Paths(
        claude=Path(os.environ.get("LLMX_CLAUDE_DIR", home / ".claude")).expanduser(),
        opencode=Path(
            os.environ.get("LLMX_OPENCODE_DIR", home / ".local" / "share" / "opencode")
        ).expanduser(),
        opencode_config=Path(
            os.environ.get("LLMX_OPENCODE_CONFIG", config_home / "opencode")
        ).expanduser(),
        dsh_sessions=Path(
            os.environ.get("LLMX_DSH_SESSIONS", home / ".dsh" / "sessions")
        ).expanduser(),
        state=state,
        profiles=state / "profiles",
        backups=state / "backups",
        garbage=state / "garbage",
    )
    dsh_profiles = Path(
        os.environ.get("LLMX_DSH_PROFILES", paths.dsh_sessions.parent / "profiles")
    ).expanduser()

    api = ApiBook.load(
        apis,
        claude_dir=paths.claude,
        opencode_dir=paths.opencode_config,
        dsh_profiles=dsh_profiles,
    )
    return Config(
        book=book,
        paths=paths,
        api=api,
        store=store,
        path=path if path.is_file() else None,
    )
