"""把三个工具各自的本地记录折算成 Record。"""

from __future__ import annotations

from datetime import datetime, timezone

from ..config import Paths
from ..model import Record
from ..snapshot import Snapshot

SOURCE_ORDER = ("claude", "opencode", "dsh")

SOURCE_LABELS = {
    "claude": "Claude Code",
    "opencode": "opencode",
    "dsh": "DeepSeek Harness",
}


class SourceError(Exception):
    """数据源读不了时抛出，CLI 会降级成警告。"""


def parse_timestamp(value: object) -> datetime | None:
    """解析 ISO 8601 时间，失败返回 None。"""
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def parse_epoch_ms(value: object) -> datetime | None:
    if not isinstance(value, (int, float)) or value <= 0:
        return None
    return datetime.fromtimestamp(value / 1000, tz=timezone.utc)


def collect(source: str, paths: Paths, snapshot: Snapshot | None = None) -> list[Record]:
    """采集一个来源的用量；给了 snapshot 就把解析结果缓存下来，没改过的文件不重扫。"""
    if source == "claude":
        from .claude import collect as run

        return run(paths.claude, snapshot)
    if source == "opencode":
        from .opencode import collect as run

        return run(paths.opencode, snapshot)
    if source == "dsh":
        from .dsh import collect as run

        return run(paths.dsh_sessions, snapshot)
    raise SourceError(f"未知数据源: {source}")
