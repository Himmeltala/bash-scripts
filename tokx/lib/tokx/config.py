"""加载配置与三个数据源的位置。"""

from __future__ import annotations

import os
import tomllib
from dataclasses import dataclass
from datetime import date, time
from pathlib import Path
from zoneinfo import ZoneInfo

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
    dsh_sessions: Path


@dataclass(slots=True)
class Config:
    book: PriceBook
    paths: Paths
    path: Path | None


def config_path(explicit: str | None = None) -> Path:
    if explicit:
        return Path(explicit).expanduser()
    if os.environ.get("TOKX_CONFIG"):
        return Path(os.environ["TOKX_CONFIG"]).expanduser()
    base = Path(os.environ.get("XDG_CONFIG_HOME", "~/.config")).expanduser()
    return base / "tokx" / "config.toml"


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


def load(explicit: str | None = None) -> Config:
    path = config_path(explicit)
    doc: dict = {}
    if explicit and not path.is_file():
        raise ConfigError(f"找不到配置文件 {path}")
    if path.is_file():
        try:
            doc = tomllib.loads(path.read_text(encoding="utf-8"))
        except (OSError, tomllib.TOMLDecodeError) as exc:
            raise ConfigError(f"读取 {path} 失败: {exc}") from exc

    models = dict(DEFAULT_MODELS)
    for name, spec in (doc.get("models") or {}).items():
        models[name] = _model_price(spec, name)

    aliases = dict(DEFAULT_ALIASES)
    for old, new in (doc.get("aliases") or {}).items():
        aliases[str(old)] = str(new)

    peak = doc.get("peak") or {}
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

    home = Path.home()
    paths = Paths(
        claude=Path(os.environ.get("TOKX_CLAUDE_DIR", home / ".claude")).expanduser(),
        opencode=Path(
            os.environ.get("TOKX_OPENCODE_DIR", home / ".local" / "share" / "opencode")
        ).expanduser(),
        dsh_sessions=Path(
            os.environ.get("TOKX_DSH_SESSIONS", home / ".dsh" / "sessions")
        ).expanduser(),
    )

    book = PriceBook(
        models=models,
        aliases=aliases,
        windows=windows,
        weekdays=weekdays,
        holidays=holidays,
        tz=tz,
    )
    return Config(book=book, paths=paths, path=path if path.is_file() else None)
