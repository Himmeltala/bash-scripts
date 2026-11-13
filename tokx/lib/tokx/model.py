"""统一的用量记录结构，三个数据源都折算成它。"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime


@dataclass(frozen=True, slots=True)
class Usage:
    """一次请求的 token 拆分，和 DeepSeek 的计费口径对齐。"""

    input: int = 0
    cache_read: int = 0
    cache_write: int = 0
    output: int = 0
    reasoning: int = 0

    @property
    def total(self) -> int:
        return self.input + self.cache_read + self.cache_write + self.output


@dataclass(slots=True)
class Record:
    """一次已结算的模型请求。"""

    source: str
    session: str
    at: datetime
    model: str
    provider: str = ""
    api: str = ""
    project: str = ""
    usage: Usage = field(default_factory=Usage)
    # 同一来源同一会话里的去重键，账本主键的一部分。
    key: str = ""
    # 这条记录是现扫到的，还是会话文件没了以后从账本补回来的。
    origin: str = "live"
