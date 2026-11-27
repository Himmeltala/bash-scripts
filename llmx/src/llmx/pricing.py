"""价格表、高峰与空闲时段判定，以及单条记录的费用计算。

价格口径来自 DeepSeek 与 mimo 官方文档：DeepSeek 空闲价是高峰价的一半；mimo 不分
峰谷，两档同价，并且只按实时推理计，批量推理的价不适用。高峰时段为北京时间
周一至周五 9:00-12:00、14:00-18:00，法定节假日全天按空闲价。
"""

from __future__ import annotations

import functools
import re
from dataclasses import dataclass, field
from datetime import date, datetime, time
from zoneinfo import ZoneInfo

from .model import Usage

DEFAULT_TZ = "Asia/Shanghai"


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


def flat_price(hit: float, miss: float, output: float) -> ModelPrice:
    """不分峰谷的模型：高峰与空闲两档同价。"""
    tier = Tier(hit=hit, miss=miss, output=output)
    return ModelPrice(off=tier, peak=tier)


# 2026-10 官方价，单位元每百万 token；mimo 是实时推理的价。
DEFAULT_MODELS: dict[str, ModelPrice] = {
    "deepseek-flash": ModelPrice(
        off=Tier(hit=0.02, miss=1.0, output=4.0),
        peak=Tier(hit=0.04, miss=2.0, output=8.0),
    ),
    "deepseek-v4-pro": ModelPrice(
        off=Tier(hit=0.15, miss=4.5, output=13.5),
        peak=Tier(hit=0.30, miss=9.0, output=27.0),
    ),
    "mimo-v2.6-flash": flat_price(hit=0.02, miss=1.0, output=2.0),
    "mimo-v2.6-pro": flat_price(hit=0.025, miss=3.0, output=6.0),
    "mimo-v2.6-pro-ultraspeed": flat_price(hit=0.25, miss=30.0, output=60.0),
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


@functools.lru_cache(maxsize=1024)
def normalize_model(name: str) -> str:
    """去掉方括号后缀与厂商前缀，统一成小写模型名；模型名就那几种，缓存起来。"""
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
    # 同一次请求里几万条记录反复查同一个模型与同一个时段；按模型名/小时把结果记住。
    _memo: dict = field(default_factory=dict, compare=False, repr=False)

    def resolve(self, model: str) -> str:
        memo = self._memo
        key = ("resolve", model)
        hit = memo.get(key)
        if hit is None:
            name = normalize_model(model)
            hit = self.aliases.get(name, name)
            memo[key] = hit
        return hit

    def price_for(self, model: str) -> ModelPrice | None:
        """查不到价格时返回 None，调用方据此把请求算作未计价。"""
        memo = self._memo
        key = ("price", model)
        if key in memo:
            return memo[key]
        name = self.resolve(model)
        found = self.models.get(name)
        if found is None and "free" in name:
            found = ModelPrice(off=ZERO_TIER, peak=ZERO_TIER, free=True)
        memo[key] = found
        return found

    def is_peak(self, at: datetime) -> bool:
        # 同一条记录在 cost / cache_saved / parts 里各问一次，按时时刻记住答案。
        memo = self._memo
        key = ("peak_at", at)
        hit = memo.get(key)
        if hit is not None:
            return hit
        local = at.astimezone(self.tz)
        if local.date() in self.holidays or local.weekday() not in self.weekdays:
            return False
        clock = local.time()
        # 时段边界都在整点时判峰与分钟内无关，按「日期 + 小时」缓存；否则照旧逐条算。
        if self._hour_aligned():
            key = ("peak", local.date(), local.hour)
            memo = self._memo
            hit = memo.get(key)
            if hit is None:
                hit = any(start <= clock < end for start, end in self.windows)
                memo[key] = hit
            memo[("peak_at", at)] = hit
            return hit
        result = any(start <= clock < end for start, end in self.windows)
        memo[("peak_at", at)] = result
        return result

    def _hour_aligned(self) -> bool:
        memo = self._memo
        hit = memo.get("hour_aligned")
        if hit is None:
            hit = all(
                start.minute == 0 and start.second == 0 and start.microsecond == 0
                and end.minute == 0 and end.second == 0 and end.microsecond == 0
                for start, end in self.windows
            )
            memo["hour_aligned"] = hit
        return hit

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

    def cache_saved(self, model: str, usage: Usage, at: datetime) -> float | None:
        """缓存读按命中价计，比全部按未命中价省下的钱；未知模型返回 None。"""
        price = self.price_for(model)
        if price is None:
            return None
        if price.free:
            return 0.0
        tier = price.peak if self.is_peak(at) else price.off
        return usage.cache_read * (tier.miss - tier.hit) / 1_000_000

    def parts(self, model: str, usage: Usage, at: datetime) -> dict[str, float] | None:
        """按 token 类别拆开的费用；未知模型返回 None，免费模型四类都是 0。"""
        price = self.price_for(model)
        if price is None:
            return None
        if price.free:
            return {"input": 0.0, "cache_read": 0.0, "cache_write": 0.0, "output": 0.0}
        tier = price.peak if self.is_peak(at) else price.off
        return {
            "input": usage.input * tier.miss / 1_000_000,
            "cache_read": usage.cache_read * tier.hit / 1_000_000,
            "cache_write": usage.cache_write * tier.miss / 1_000_000,
            "output": usage.output * tier.output / 1_000_000,
        }
