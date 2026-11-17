"""flow 与采集状态的 sqlite 存储。"""

from __future__ import annotations

import json
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
CREATE TABLE IF NOT EXISTS flow_detail (
  flow_id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT '',
  host TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  sni TEXT NOT NULL DEFAULT '',
  dns_name TEXT NOT NULL DEFAULT '',
  dns_type TEXT NOT NULL DEFAULT '',
  raw BLOB NOT NULL DEFAULT x'',
  parsed TEXT NOT NULL DEFAULT '{}',
  truncated INTEGER NOT NULL DEFAULT 0,
  updated REAL NOT NULL
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
        sql = (
            "SELECT f.*, d.kind AS detail_kind, d.host AS detail_host,"
            " d.url AS detail_url, d.sni AS detail_sni, d.dns_name AS detail_dns_name,"
            " CASE WHEN d.flow_id IS NULL THEN 0 ELSE 1 END AS has_detail"
            " FROM flows f LEFT JOIN flow_detail d ON d.flow_id = f.id"
        )
        args: list[float | int] = []
        if minutes is not None:
            # 开得久但还在发的连接不该被时间窗藏掉。
            sql += " WHERE (f.started >= ? OR f.ended IS NULL)"
            args.append(time.time() - minutes * 60)
        sql += " ORDER BY f.started DESC LIMIT ?"
        args.append(limit)
        with self._conn() as conn:
            return [dict(row) for row in conn.execute(sql, args)]

    def flow(self, flow_id: int) -> dict | None:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT f.*, d.kind AS detail_kind, d.host AS detail_host,"
                " d.url AS detail_url, d.sni AS detail_sni, d.dns_name AS detail_dns_name,"
                " CASE WHEN d.flow_id IS NULL THEN 0 ELSE 1 END AS has_detail"
                " FROM flows f LEFT JOIN flow_detail d ON d.flow_id = f.id"
                " WHERE f.id = ?",
                (int(flow_id),),
            ).fetchone()
        return dict(row) if row is not None else None

    def set_detail(self, flow_id: int, raw: bytes, parsed: dict, *, truncated: bool = False) -> None:
        """写入或覆盖一条连接的详情；同一连接只留一份。"""
        parsed = parsed if isinstance(parsed, dict) else {}
        fields = (
            str(parsed.get("kind") or ""),
            str(parsed.get("host") or ""),
            str(parsed.get("url") or ""),
            str(parsed.get("sni") or ""),
            str(parsed.get("dns_name") or ""),
            str(parsed.get("dns_type") or ""),
            bytes(raw or b""),
            json.dumps(parsed, ensure_ascii=False),
            1 if truncated else 0,
            time.time(),
            int(flow_id),
        )
        with self._conn() as conn:
            conn.execute(
                "INSERT INTO flow_detail"
                " (kind, host, url, sni, dns_name, dns_type, raw, parsed, truncated, updated, flow_id)"
                " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
                " ON CONFLICT(flow_id) DO UPDATE SET"
                " kind = excluded.kind, host = excluded.host, url = excluded.url,"
                " sni = excluded.sni, dns_name = excluded.dns_name, dns_type = excluded.dns_type,"
                " raw = excluded.raw, parsed = excluded.parsed,"
                " truncated = excluded.truncated, updated = excluded.updated",
                fields,
            )

    def detail(self, flow_id: int) -> dict | None:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM flow_detail WHERE flow_id = ?", (int(flow_id),)
            ).fetchone()
        if row is None:
            return None
        data = dict(row)
        try:
            parsed = json.loads(data.get("parsed") or "{}")
        except (TypeError, ValueError):
            parsed = {}
        return {
            "id": int(data["flow_id"]),
            "kind": data.get("kind") or "",
            "host": data.get("host") or "",
            "url": data.get("url") or "",
            "sni": data.get("sni") or "",
            "dns_name": data.get("dns_name") or "",
            "dns_type": data.get("dns_type") or "",
            "raw": data.get("raw") or b"",
            "parsed": parsed if isinstance(parsed, dict) else {},
            "truncated": bool(data.get("truncated")),
            "updated": float(data.get("updated") or 0),
        }

    def _db_bytes(self) -> int:
        total = 0
        for suffix in ("", "-wal", "-shm"):
            try:
                total += os.path.getsize(str(self.path) + suffix)
            except OSError:
                pass
        return total

    def clean(
        self,
        *,
        before_ts: float | None = None,
        all_ended: bool = False,
        dry_run: bool = False,
    ) -> dict:
        """删已结束的连接与详情；进行中的一律保留。时间按最后活跃时间算。"""
        if before_ts is None and not all_ended:
            raise ValueError("clean 需要 before_ts 或 all_ended")

        where = "ended IS NOT NULL"
        args: list[float] = []
        if before_ts is not None:
            where += " AND last_seen < ?"
            args.append(float(before_ts))

        before = self._db_bytes()
        with self._conn() as conn:
            flows = int(
                conn.execute("SELECT COUNT(*) FROM flows WHERE " + where, args).fetchone()[0]
            )
            details = int(
                conn.execute(
                    "SELECT COUNT(*) FROM flow_detail WHERE flow_id IN"
                    " (SELECT id FROM flows WHERE " + where + ")",
                    args,
                ).fetchone()[0]
            )
            active = int(
                conn.execute("SELECT COUNT(*) FROM flows WHERE ended IS NULL").fetchone()[0]
            )
            if not dry_run:
                conn.execute(
                    "DELETE FROM flow_detail WHERE flow_id IN"
                    " (SELECT id FROM flows WHERE " + where + ")",
                    args,
                )
                conn.execute("DELETE FROM flows WHERE " + where, args)

        vacuum_error = ""
        if not dry_run and flows:
            try:
                self._vacuum()
            except Exception as exc:
                # 删除已经提交；压缩失败只报告，不让用户以为数据没删。
                vacuum_error = str(exc) or exc.__class__.__name__

        return {
            "flows": flows,
            "details": details,
            "active_kept": active,
            "db_bytes_before": before,
            "db_bytes_after": self._db_bytes(),
            "vacuum_error": vacuum_error,
        }

    def _vacuum(self) -> None:
        with self._conn() as conn:
            conn.isolation_level = None
            conn.execute("VACUUM")

    def summary(self) -> dict:
        with self._conn() as conn:
            flow_count = int(conn.execute("SELECT COUNT(*) FROM flows").fetchone()[0])
            detail_count = int(conn.execute("SELECT COUNT(*) FROM flow_detail").fetchone()[0])
            active_count = int(
                conn.execute("SELECT COUNT(*) FROM flows WHERE ended IS NULL").fetchone()[0]
            )
            span = conn.execute("SELECT MIN(started), MAX(started) FROM flows").fetchone()
        return {
            "db_bytes": self._db_bytes(),
            "flow_count": flow_count,
            "detail_count": detail_count,
            "active_count": active_count,
            "oldest": float(span[0] or 0),
            "newest": float(span[1] or 0),
        }

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
