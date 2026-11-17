"""把事件归并成 flow：连接建立一条，字节累加，关闭或进程退出结束。"""

from __future__ import annotations

import os
import threading
import time
from pathlib import Path

from . import proc
from .parse import parse_payload


def pid_alive(pid: int) -> bool:
    """线程退出时进程还在；进程退出后 /proc 会消失或只剩 Z 状态。"""
    try:
        stat = Path("/proc/%d/stat" % pid).read_text(encoding="utf-8", errors="replace")
    except OSError:
        return False
    try:
        state = stat[stat.rindex(")") + 2]
    except (ValueError, IndexError):
        return False
    return state not in ("Z", "X", "x")


class FlowTracker:
    CAPTURE_BYTES = 8192
    FLUSH_SECONDS = 2.0

    def __init__(
        self,
        db,
        clock=time.time,
        idle=3600.0,
        proc_info=proc.info,
        pid_alive=pid_alive,
    ):
        self.db = db
        self.clock = clock
        self.idle = idle
        self.proc_info = proc_info
        self.pid_alive = pid_alive
        self.capture_bytes = self._capture_limit()
        self._lock = threading.RLock()
        self._active: dict[tuple[int, int], dict] = {}
        # 进程退出时最后一批字节还在 bpftrace 的 map 里；隔几秒确认进程真没了再收尾。
        self._exited: dict[int, float] = {}
        self.exit_grace = 3.0

    @classmethod
    def _capture_limit(cls):
        """环境变量只能在默认上限以内往下调，不能超过 BPF 侧的封顶。"""
        try:
            value = int(os.environ.get("NETX_CAPTURE_BYTES", ""))
        except (TypeError, ValueError):
            return cls.CAPTURE_BYTES
        return max(1024, min(cls.CAPTURE_BYTES, value))

    def _entry(self, flow_id: int, now: float, event: dict) -> dict:
        return {
            "id": flow_id,
            "last": now,
            "start": now,
            "family": event["family"],
            "ip": event["ip"],
            "port": event["port"],
            "bytes_out": 0,
            "payload": bytearray(),
            "payload_truncated": False,
            "payload_dirty": False,
            "payload_flushed_at": 0.0,
        }

    def on_event(self, event: dict) -> None:
        kind = event.get("type")
        with self._lock:
            if kind == "connect":
                self._connect(event)
            elif kind == "bytes":
                self._bytes(event)
            elif kind == "udp":
                self._udp(event)
            elif kind == "payload":
                self._payload(event)
            elif kind == "close":
                self._finish((event["pid"], event["fd"]), self.clock())
            elif kind == "exit":
                self._exit(event["pid"])

    def _connect(self, event: dict) -> None:
        now = self.clock()
        pid = event["pid"]
        key = (pid, event["fd"])
        self._finish(key, now)
        # 同一个 pid 又被用上，说明上一个进程已经走完，退出标记作废。
        self._exited.pop(pid, None)
        flow_id = self._new_flow(pid, event)
        self._active[key] = self._entry(flow_id, now, event)

    def _udp(self, event: dict) -> None:
        """没 connect 的 UDP：同一个 fd 换一个目的地址就另起一条 flow。"""
        now = self.clock()
        pid = event["pid"]
        key = (pid, event["fd"])
        entry = self._active.get(key)
        if (
            entry is not None
            and entry.get("family") == event["family"]
            and entry.get("ip") == event["ip"]
            and entry.get("port") == event["port"]
        ):
            self.db.add_bytes(entry["id"], event["delta"], now)
            entry["last"] = now
            entry["bytes_out"] = entry.get("bytes_out", 0) + int(event["delta"])
            self._mark_truncated(entry)
            return
        self._finish(key, now)
        flow_id = self._new_flow(pid, event)
        entry = self._entry(flow_id, now, event)
        self._active[key] = entry
        self.db.add_bytes(flow_id, event["delta"], now)
        entry["bytes_out"] = int(event["delta"])

    def _new_flow(self, pid: int, event: dict) -> int:
        info = self.proc_info(pid)
        comm = info.get("comm") or event.get("comm", "")
        uid = info.get("uid", -1)
        if uid is None or uid < 0:
            uid = event.get("uid", -1)
        return self.db.add_flow(
            started=self.clock(),
            pid=pid,
            uid=uid,
            comm=comm,
            exe=info.get("exe", ""),
            family=event["family"],
            dst_ip=event["ip"],
            dst_port=event["port"],
        )

    def _bytes(self, event: dict) -> None:
        entry = self._active.get((event["pid"], event["fd"]))
        if entry is None:
            return
        now = self.clock()
        self.db.add_bytes(entry["id"], event["delta"], now)
        entry["last"] = now
        entry["bytes_out"] = entry.get("bytes_out", 0) + int(event["delta"])
        self._mark_truncated(entry)

    def _mark_truncated(self, entry: dict) -> None:
        """实际发出的字节比抓到的多，说明内容已经被截断（eBPF 到顶后不再发事件）。"""
        if (
            entry.get("payload")
            and not entry.get("payload_truncated")
            and entry.get("bytes_out", 0) > len(entry["payload"])
        ):
            entry["payload_truncated"] = True
            entry["payload_dirty"] = True

    def _payload(self, event: dict) -> None:
        entry = self._active.get((event["pid"], event["fd"]))
        if entry is None:
            return
        now = self.clock()
        data = event.get("data") or b""
        remaining = self.capture_bytes - len(entry["payload"])
        if remaining <= 0:
            if not entry["payload_truncated"]:
                entry["payload_truncated"] = True
                entry["payload_dirty"] = True
            entry["last"] = now
            return
        taken = data[:remaining]
        if len(taken) < len(data):
            entry["payload_truncated"] = True
        original = event.get("length")
        try:
            if int(original) > len(taken):
                entry["payload_truncated"] = True
        except (TypeError, ValueError):
            pass
        if taken:
            entry["payload"].extend(taken)
            entry["payload_dirty"] = True
        entry["last"] = now
        self._mark_truncated(entry)

    def _flush_entry(self, entry: dict, now: float) -> None:
        data = bytes(entry["payload"])
        parsed = parse_payload(data, dst_port=entry.get("port", 0))
        truncated = entry["payload_truncated"] or (
            bool(data) and entry.get("bytes_out", 0) > len(data)
        )
        self.db.set_detail(entry["id"], data, parsed, truncated=truncated)
        entry["payload_dirty"] = False
        entry["payload_flushed_at"] = now

    def flush_payloads(self, force: bool = False) -> None:
        """把活动连接已抓到的头部内容落库；默认按间隔节流，连接结束时强制刷新。"""
        with self._lock:
            now = self.clock()
            for entry in list(self._active.values()):
                if not entry.get("payload_dirty"):
                    continue
                if not force and now - entry.get("payload_flushed_at", 0.0) < self.FLUSH_SECONDS:
                    continue
                try:
                    self._flush_entry(entry, now)
                except Exception:
                    # 单条内容坏了不能拖住后面所有连接，也不能每轮重试刷屏。
                    entry["payload_dirty"] = False

    def _exit(self, pid: int) -> None:
        if any(key[0] == pid for key in self._active):
            self._exited[pid] = self.clock()

    def _finish(self, key: tuple[int, int], now: float) -> None:
        entry = self._active.pop(key, None)
        if entry is None:
            return
        try:
            if entry.get("payload_dirty"):
                self._flush_entry(entry, now)
        except Exception:
            pass
        finally:
            # 内容写失败也要把连接结束掉，不能留下一直“进行中”的行。
            self.db.end_flow(entry["id"], now)

    def tick(self) -> None:
        with self._lock:
            now = self.clock()
            self.db.expire(now, self.idle)
            stale = [key for key, entry in self._active.items() if entry["last"] < now - self.idle]
            for key in stale:
                self._active.pop(key, None)

            for pid, at in list(self._exited.items()):
                if now - at < self.exit_grace:
                    continue
                if self.pid_alive(pid):
                    # 只是某个线程退了，进程还在。
                    self._exited.pop(pid, None)
                    continue
                keys = [key for key in self._active if key[0] == pid and self._active[key]["start"] <= at]
                for key in keys:
                    self._finish(key, at)
                if not any(key[0] == pid for key in self._active):
                    self._exited.pop(pid, None)

            self.flush_payloads()

    def close_all(self) -> None:
        with self._lock:
            now = self.clock()
            for key in list(self._active):
                self._finish(key, now)
