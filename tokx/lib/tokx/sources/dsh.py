"""DeepSeek Harness：读 ~/.dsh/sessions 下 zstd 压缩的会话日志。"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Iterator

from ..model import Record, Usage
from . import parse_epoch_ms


def collect(root: Path) -> list[Record]:
    if not root.is_dir():
        return []

    records: list[Record] = []
    for path in sorted(root.rglob("session*.jsonl*")):
        if not path.is_file():
            continue
        try:
            records.extend(_session(path))
        except (OSError, RuntimeError, ValueError, TypeError, KeyError):
            continue
    return records


def _session(path: Path) -> list[Record]:
    session_id = path.parent.name
    project = ""
    route: tuple[str, str] = ("", "")
    seen: dict[tuple[int, int], Record] = {}

    for line in _lines(path):
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not isinstance(event, dict):
            continue
        kind = event.get("type")
        data = event.get("data")
        if kind == "session" and isinstance(data, dict):
            session_id = str(data.get("id") or session_id)
            project = str(data.get("cwd") or "")
        elif kind == "request/header" and isinstance(data, dict):
            header = data.get("header")
            config = header.get("config") if isinstance(header, dict) else None
            if isinstance(config, dict):
                route = (str(config.get("provider") or ""), str(config.get("model") or ""))
        elif kind == "assistant/message" and isinstance(data, dict):
            usage = data.get("usage")
            if not isinstance(usage, dict):
                continue
            at = parse_epoch_ms(event.get("time"))
            if at is None:
                continue
            record = Record(
                source="dsh",
                session=session_id,
                at=at,
                model=route[1],
                provider=route[0],
                project=project,
                usage=Usage(
                    input=_count(usage.get("inputTokens")),
                    cache_read=_count(usage.get("cacheReadTokens")),
                    cache_write=_count(usage.get("cacheWriteTokens")),
                    output=_count(usage.get("outputTokens")),
                    reasoning=_count(usage.get("reasoningTokens")),
                ),
            )
            if record.usage.total == 0:
                continue
            # 同一步骤重试时只保留最后一次结算。
            seen[(_to_int(data.get("turn")), _to_int(data.get("step")))] = record

    return list(seen.values())


def _lines(path: Path) -> Iterator[str]:
    if path.suffix == ".zstd":
        try:
            proc = subprocess.Popen(
                ["zstd", "-dc", str(path)],
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
            )
        except FileNotFoundError as exc:
            raise RuntimeError("需要 zstd 命令解压会话日志") from exc
        assert proc.stdout is not None
        try:
            for raw in proc.stdout:
                yield raw.decode("utf-8", "replace")
        finally:
            proc.stdout.close()
            proc.wait()
        return

    with path.open("r", encoding="utf-8", errors="replace") as handle:
        yield from handle


def _to_int(value: object) -> int:
    return value if isinstance(value, int) and not isinstance(value, bool) else 0


def _count(value: object) -> int:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return 0
    return max(int(value), 0)
