"""价格表、高峰与空闲时段判定，以及单条记录的费用计算。

价格口径来自 DeepSeek 官方文档：空闲价是高峰价的一半；高峰时段为北京时间
周一至周五 9:00-12:00、14:00-18:00，法定节假日全天按空闲价。
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, datetime, time
from zoneinfo import ZoneInfo

from .model import Usage

DEFAULT_TZ = "Asia/Shanghai"
CURRENCY = "CNY"


@dataclass(frozen=True, slots=True)
class Tier:
    """一个计费档的单价，单位为元每百万 token。"""

    hit: float
    miss: float
    output: float


ZERO_TIER = Tier(0.0, 0.0, 0.0)


@dataclass(frozen=True, slots=True)
class ModelPrice:
    """一个模型的空闲价与高峰价。"""

    off: Tier
    peak: Tier
    free: bool = False


# 2026-10 官方价，单位元每百万 token。
DEFAULT_MODELS: dict[str, ModelPrice] = {
    "deepseek-flash": ModelPrice(
        off=Tier(hit=0.02, miss=1.0, output=4.0),
        peak=Tier(hit=0.04, miss=2.0, output=8.0),
    ),
    "deepseek-v4-pro": ModelPrice(
        off=Tier(hit=0.15, miss=4.5, output=13.5),
        peak=Tier(hit=0.30, miss=9.0, output=27.0),
    ),
}

# 旧模型名与带版本的写法都归到当前在售名称。
DEFAULT_ALIASES: dict[str, str] = {
    "deepseek-v4-flash": "deepseek-flash",
    "deepseek-v4-flash-vision-exp": "deepseek-flash",
    "deepseek-v4.1-flash": "deepseek-flash",
    "deepseek-v4.1-flash-1017": "deepseek-flash",
    "deepseek-v4-pro-0813": "deepseek-v4-pro",
}

DEFAULT_WINDOWS: tuple[tuple[time, time], ...] = (
    (time(9, 0), time(12, 0)),
    (time(14, 0), time(18, 0)),
)
DEFAULT_WEEKDAYS = frozenset({0, 1, 2, 3, 4})


def normalize_model(name: str) -> str:
    """去掉方括号后缀与厂商前缀，统一成小写模型名。"""
    value = (name or "").strip().lower()
    value = re.sub(r"\[[^\]]*\]$", "", value)
    value = value.rsplit("/", 1)[-1]
    return value


@dataclass(frozen=True, slots=True)
class PriceBook:
    models: dict[str, ModelPrice] = field(default_factory=lambda: dict(DEFAULT_MODELS))
    aliases: dict[str, str] = field(default_factory=lambda: dict(DEFAULT_ALIASES))
    windows: tuple[tuple[time, time], ...] = DEFAULT_WINDOWS
    weekdays: frozenset[int] = DEFAULT_WEEKDAYS
    holidays: frozenset[date] = frozenset()
    tz: ZoneInfo = ZoneInfo(DEFAULT_TZ)

    def resolve(self, model: str) -> str:
        name = normalize_model(model)
        return self.aliases.get(name, name)

    def price_for(self, model: str) -> ModelPrice | None:
        """查不到价格时返回 None，调用方据此把请求算作未计价。"""
        name = self.resolve(model)
        found = self.models.get(name)
        if found is not None:
            return found
        if "free" in name:
            return ModelPrice(off=ZERO_TIER, peak=ZERO_TIER, free=True)
        return None

    def is_peak(self, at: datetime) -> bool:
        local = at.astimezone(self.tz)
        if local.date() in self.holidays or local.weekday() not in self.weekdays:
            return False
        clock = local.time()
        return any(start <= clock < end for start, end in self.windows)

    def cost(self, model: str, usage: Usage, at: datetime) -> float | None:
        """按请求发生时刻选档，算出人民币金额；未知模型返回 None。"""
        price = self.price_for(model)
        if price is None:
            return None
        if price.free:
            return 0.0
        tier = price.peak if self.is_peak(at) else price.off
        tokens = (
            usage.input * tier.miss
            + usage.cache_read * tier.hit
            + usage.cache_write * tier.miss
            + usage.output * tier.output
        )
        return tokens / 1_000_000
