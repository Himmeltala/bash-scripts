"""flow 与采集状态的 sqlite 存储。"""

from __future__ import annotations

import os
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path

from . import paths

SCHEMA = """
CREATE TABLE IF NOT EXISTS flows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started REAL NOT NULL,
  ended REAL,
  last_seen REAL NOT NULL,
  pid INTEGER NOT NULL,
  uid INTEGER NOT NULL,
  comm TEXT NOT NULL,
  exe TEXT NOT NULL DEFAULT '',
  family INTEGER NOT NULL,
  dst_ip TEXT NOT NULL,
  dst_port INTEGER NOT NULL,
  host TEXT NOT NULL DEFAULT '',
  host_source TEXT NOT NULL DEFAULT '',
  bytes_out INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS flows_started ON flows(started DESC);
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
"""


class Database:
    """每条连接一个 sqlite 连接：采集线程与网页线程各用各的，WAL 负责并发。"""

    def __init__(self, path: Path | None = None):
        self.path = Path(path) if path else paths.db_path()

    def init(self) -> "Database":
        paths.ensure_dir(self.path.parent)
        conn = sqlite3.connect(self.path, timeout=10)
        try:
            conn.execute("PRAGMA journal_mode=WAL")
            conn.executescript(SCHEMA)
            conn.commit()
        finally:
            conn.close()
        try:
            os.chmod(self.path, 0o600)
        except OSError:
            pass
        paths._chown(self.path)
        return self

    @contextmanager
    def _conn(self):
        conn = sqlite3.connect(self.path, timeout=10)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def add_flow(
        self,
        *,
        started: float,
        pid: int,
        uid: int,
        comm: str,
        exe: str,
        family: int,
        dst_ip: str,
        dst_port: int,
    ) -> int:
        with self._conn() as conn:
            cur = conn.execute(
                "INSERT INTO flows (started, last_seen, pid, uid, comm, exe, family, dst_ip, dst_port)"
                " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (started, started, pid, uid, comm, exe, family, dst_ip, dst_port),
            )
            return int(cur.lastrowid)

    def add_bytes(self, flow_id: int, delta: int, at: float) -> None:
        if delta <= 0:
            return
        with self._conn() as conn:
            conn.execute(
                "UPDATE flows SET bytes_out = bytes_out + ?, last_seen = ? WHERE id = ?",
                (delta, at, flow_id),
            )

    def end_flow(self, flow_id: int, ended: float) -> None:
        with self._conn() as conn:
            conn.execute(
                "UPDATE flows SET ended = COALESCE(ended, ?), last_seen = MAX(last_seen, ?)"
                " WHERE id = ?",
                (ended, ended, flow_id),
            )

    def expire(self, now: float, idle: float = 300.0) -> int:
        with self._conn() as conn:
            cur = conn.execute(
                "UPDATE flows SET ended = last_seen"
                " WHERE ended IS NULL AND last_seen < ?",
                (now - idle,),
            )
            return cur.rowcount

    def flows(self, minutes: float | None = None, limit: int = 500) -> list[dict]:
        sql = "SELECT * FROM flows"
        args: list[float | int] = []
        if minutes is not None:
            # 开得久但还在发的连接不该被时间窗藏掉。
            sql += " WHERE (started >= ? OR ended IS NULL)"
            args.append(time.time() - minutes * 60)
        sql += " ORDER BY started DESC LIMIT ?"
        args.append(limit)
        with self._conn() as conn:
            return [dict(row) for row in conn.execute(sql, args)]

    def count_flows(self) -> int:
        with self._conn() as conn:
            return int(conn.execute("SELECT COUNT(*) FROM flows").fetchone()[0])

    def set_meta(self, key: str, value: str) -> None:
        with self._conn() as conn:
            conn.execute(
                "INSERT INTO meta (key, value) VALUES (?, ?)"
                " ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                (key, str(value)),
            )

    def get_meta(self, key: str, default: str = "") -> str:
        with self._conn() as conn:
            row = conn.execute("SELECT value FROM meta WHERE key = ?", (key,)).fetchone()
            return row["value"] if row else default

    def meta(self) -> dict:
        with self._conn() as conn:
            return {row["key"]: row["value"] for row in conn.execute("SELECT key, value FROM meta")}
