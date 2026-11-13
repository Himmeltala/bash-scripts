"""用量账本：把每条请求按天落进 sqlite，会话文件删掉以后还能回显。

账本只作追加，口径与现扫一致：一行一条请求，主键 (来源, 会话, 去重键) 重复导入
不会翻倍。接口地址随请求入库，换了地址之后老记录保留原地址；费用不入账，出表时
按当前价格表现算。
"""

from __future__ import annotations

import sqlite3
import time
from collections.abc import Iterable
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from .model import Record, Usage

SCHEMA = (
    """
    CREATE TABLE IF NOT EXISTS request (
        source      TEXT    NOT NULL,
        session     TEXT    NOT NULL,
        project     TEXT    NOT NULL DEFAULT '',
        api         TEXT    NOT NULL DEFAULT '',
        day         TEXT    NOT NULL,
        at          INTEGER NOT NULL,
        provider    TEXT    NOT NULL DEFAULT '',
        model       TEXT    NOT NULL DEFAULT '',
        key         TEXT    NOT NULL,
        input       INTEGER NOT NULL DEFAULT 0,
        cache_read  INTEGER NOT NULL DEFAULT 0,
        cache_write INTEGER NOT NULL DEFAULT 0,
        output      INTEGER NOT NULL DEFAULT 0,
        reasoning   INTEGER NOT NULL DEFAULT 0,
        loud        INTEGER NOT NULL DEFAULT 1,
        seen_at     INTEGER NOT NULL,
        PRIMARY KEY (source, session, key)
    )
    """,
    "CREATE INDEX IF NOT EXISTS request_by_day ON request (source, day)",
    """
    CREATE TABLE IF NOT EXISTS session_seen (
        source  TEXT    NOT NULL,
        session TEXT    NOT NULL,
        last_at INTEGER NOT NULL,
        PRIMARY KEY (source, session)
    )
    """,
)

# 账本里的记录带一个去重键，现扫的记录靠来源模块自己保证不重复，两者分开走。
_INSERT = """
INSERT OR IGNORE INTO request
    (source, session, project, api, day, at, provider, model, key,
     input, cache_read, cache_write, output, reasoning, loud, seen_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
"""

_TOUCH = """
INSERT INTO session_seen (source, session, last_at) VALUES (?, ?, ?)
ON CONFLICT (source, session) DO UPDATE SET last_at = excluded.last_at
"""


def _migrate(con: sqlite3.Connection) -> None:
    """老账本没有 api 列，补上；已有记录留空，出表时按当前配置回填。"""
    columns = {row[1] for row in con.execute("pragma table_info(request)")}
    if "api" not in columns:
        con.execute("alter table request add column api text not null default ''")


class StoreError(Exception):
    """账本读不了、写不了时抛出，CLI 会降级成警告。"""


class Store:
    """账本句柄，按需建库，用完关掉。"""

    def __init__(self, path: Path, tz: ZoneInfo) -> None:
        self.path = path
        self.tz = tz
        self._con: sqlite3.Connection | None = None

    def __enter__(self) -> Store:
        try:
            if str(self.path) != ":memory:":
                self.path.parent.mkdir(parents=True, exist_ok=True)
            con = sqlite3.connect(str(self.path))
            for statement in SCHEMA:
                con.execute(statement)
            _migrate(con)
            con.commit()
        except (OSError, sqlite3.Error) as exc:
            raise StoreError(f"打不开账本 {self.path}: {exc}") from exc
        self._con = con
        return self

    def __exit__(self, *exc_info: object) -> None:
        self.close()

    def close(self) -> None:
        if self._con is not None:
            self._con.close()
            self._con = None

    @property
    def con(self) -> sqlite3.Connection:
        if self._con is None:
            raise StoreError("账本没打开")
        return self._con

    def insert(self, batches: dict[str, dict[str, list[Record]]]) -> int:
        """把现扫结果写进账本，返回实际新增的行数。
        batches 形如 {来源: {会话: [记录, ...]}}；本次条数少于账本见过的 loud 时先删旧行，免得截断掉的请求被当历史回显。
        """
        now = int(time.time() * 1000)
        rows = []
        touched = []
        lowered = []
        for source, sessions in batches.items():
            for session, records in sessions.items():
                good = [record for record in records if getattr(record, "key", "")]
                loud = len(good)
                peak = self._loudest(source, session)
                if peak and loud < peak:
                    lowered.append((source, session))
                for record in good:
                    rows.append(
                        (
                            source,
                            session,
                            record.project,
                            record.api,
                            record.at.astimezone(self.tz).date().isoformat(),
                            int(record.at.timestamp() * 1000),
                            record.provider,
                            record.model,
                            record.key,
                            record.usage.input,
                            record.usage.cache_read,
                            record.usage.cache_write,
                            record.usage.output,
                            record.usage.reasoning,
                            loud,
                            now,
                        )
                    )
                touched.append((source, session, loud))
        try:
            before = self.con.total_changes
            with self.con:
                if lowered:
                    self.con.executemany(
                        "delete from request where source = ? and session = ?", lowered
                    )
                self.con.executemany(_INSERT, rows)
                self.con.executemany(_TOUCH, touched)
            return self.con.total_changes - before
        except sqlite3.Error as exc:
            raise StoreError(f"写账本失败: {exc}") from exc

    def _loudest(self, source: str, session: str) -> int:
        try:
            row = self.con.execute(
                "select max(loud) from request where source = ? and session = ?",
                (source, session),
            ).fetchone()
        except sqlite3.Error as exc:
            raise StoreError(f"读账本失败: {exc}") from exc
        return int(row[0] or 0) if row else 0

    def sessions(self, sources: Iterable[str]) -> dict[tuple[str, str], dict]:
        """账本里已采到的会话：last_at 是最后采集时间，stored 是现有条数，loudest 由调用方抬高上限。"""
        wanted = tuple(sources)
        if not wanted:
            return {}
        marks = ",".join("?" * len(wanted))
        try:
            seen = self.con.execute(
                "select source, session, last_at from session_seen"
                f" where source in ({marks})",
                wanted,
            ).fetchall()
            marks2 = ",".join("?" * len(wanted))
            counted = self.con.execute(
                "select source, session, count(*) from request"
                f" where source in ({marks2}) group by source, session",
                wanted,
            ).fetchall()
        except sqlite3.Error as exc:
            raise StoreError(f"读账本失败: {exc}") from exc
        result: dict[tuple[str, str], dict] = {}
        for source, session, last_at in seen:
            result[(str(source), str(session))] = {
                "last_at": int(last_at),
                "stored": 0,
                "loudest": 0,
            }
        loud = self.con.execute(
            "select source, session, max(loud) from request"
            f" where source in ({marks}) group by source, session",
            wanted,
        ).fetchall()
        for source, session, count in counted:
            item = result.setdefault(
                (str(source), str(session)), {"last_at": 0, "stored": 0, "loudest": 0}
            )
            item["stored"] = int(count)
        for source, session, peak in loud:
            item = result.setdefault(
                (str(source), str(session)), {"last_at": 0, "stored": 0, "loudest": 0}
            )
            item["loudest"] = int(peak or 0)
        return result

    def records(
        self,
        sources: Iterable[str],
        start: int | None = None,
        end: int | None = None,
    ) -> list[Record]:
        """账本里的请求，折算成与现扫同形的 Record；start 与 end 是毫秒时间戳，前闭后开。"""
        wanted = tuple(sources)
        if not wanted:
            return []
        marks = ",".join("?" * len(wanted))
        where = [f"source in ({marks})"]
        params: list[object] = list(wanted)
        if start is not None:
            where.append("at >= ?")
            params.append(int(start))
        if end is not None:
            where.append("at < ?")
            params.append(int(end))
        try:
            rows = self.con.execute(
                "select source, session, project, api, at, provider, model, key,"
                " input, cache_read, cache_write, output, reasoning"
                " from request where " + " and ".join(where),
                params,
            ).fetchall()
        except sqlite3.Error as exc:
            raise StoreError(f"读账本失败: {exc}") from exc
        return [
            Record(
                source=str(row[0]),
                session=str(row[1]),
                at=datetime.fromtimestamp(int(row[4]) / 1000, tz=timezone.utc),
                model=str(row[6]),
                provider=str(row[5]),
                project=str(row[2]),
                api=str(row[3]),
                usage=Usage(
                    input=int(row[8]),
                    cache_read=int(row[9]),
                    cache_write=int(row[10]),
                    output=int(row[11]),
                    reasoning=int(row[12]),
                ),
                key=str(row[7]),
            )
            for row in rows
        ]

    def forget(self, sessions: Iterable[tuple[str, str]]) -> int:
        """删掉指定会话的记录，返回删了多少行。"""
        items = list(sessions)
        if not items:
            return 0
        try:
            before = self.con.total_changes
            with self.con:
                self.con.executemany(
                    "delete from request where source = ? and session = ?", items
                )
                self.con.executemany(
                    "delete from session_seen where source = ? and session = ?", items
                )
            return self.con.total_changes - before
        except sqlite3.Error as exc:
            raise StoreError(f"写账本失败: {exc}") from exc

    def stale(self, sources: Iterable[str], keep_days: int) -> list[tuple[str, str]]:
        """超过 keep_days 天没再采到的会话；按请求时间算而非采集时间，否则老会话反复被扫到就永远清不掉。"""
        wanted = tuple(sources)
        if not wanted:
            return []
        marks = ",".join("?" * len(wanted))
        cutoff = int((time.time() - keep_days * 86400) * 1000)
        try:
            rows = self.con.execute(
                "select source, session from request"
                f" where source in ({marks}) group by source, session"
                " having max(at) < ?",
                (*wanted, cutoff),
            ).fetchall()
        except sqlite3.Error as exc:
            raise StoreError(f"读账本失败: {exc}") from exc
        return [(str(row[0]), str(row[1])) for row in rows]

    def clear(self, sources: Iterable[str] | None = None) -> None:
        """清空账本，sources 为空时全部清掉，rebuild 用。"""
        wanted = tuple(sources or ())
        try:
            with self.con:
                if wanted:
                    marks = ",".join("?" * len(wanted))
                    self.con.execute(f"delete from request where source in ({marks})", wanted)
                    self.con.execute(f"delete from session_seen where source in ({marks})", wanted)
                else:
                    self.con.execute("delete from request")
                    self.con.execute("delete from session_seen")
        except sqlite3.Error as exc:
            raise StoreError(f"写账本失败: {exc}") from exc

    def stats(self) -> dict:
        try:
            rows, sessions = self.con.execute(
                "select count(*), count(distinct source || '/' || session) from request"
            ).fetchone()
            newest = self.con.execute("select max(seen_at) from request").fetchone()[0]
            by_source = self.con.execute(
                "select source, count(*), count(distinct session) from request"
                " group by source order by source"
            ).fetchall()
            span = self.con.execute("select min(at), max(at) from request").fetchone()
        except sqlite3.Error as exc:
            raise StoreError(f"读账本失败: {exc}") from exc
        return {
            "path": str(self.path),
            "requests": int(rows),
            "sessions": int(sessions),
            "first_at": _iso(span[0]),
            "last_at": _iso(span[1]),
            "seen_at": int(newest) if newest is not None else None,
            "sources": [
                {"source": str(row[0]), "requests": int(row[1]), "sessions": int(row[2])}
                for row in by_source
            ],
        }


def _iso(ms: object) -> str | None:
    if not isinstance(ms, (int, float)):
        return None
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).isoformat(timespec="seconds")
