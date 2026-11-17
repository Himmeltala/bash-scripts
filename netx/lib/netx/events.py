"""解析 bpftrace 的行事件。字段用制表符分开，坏行返回 None。"""

from __future__ import annotations

import re
import socket
import struct

# interval 里 print(@bytes) 的一行：@bytes[1234, 5]: 88
_MAP_BYTES = re.compile(r"^@bytes\[(\d+), (\d+)\]: (\d+)$")


def format_ipv4(value: str) -> str:
    """bpftrace 把一个 32 位整数按本机字节序读出来，pack 回去就是网络字节序。"""
    return socket.inet_ntoa(struct.pack("<I", int(value, 16)))


def format_ipv6(words: list[str]) -> str:
    raw = b"".join(struct.pack("<I", int(word, 16)) for word in words)
    return socket.inet_ntop(socket.AF_INET6, raw)


def parse(line: str) -> dict | None:
    parts = line.rstrip("\n").split("\t")
    kind = parts[0] if parts else ""
    try:
        if kind == "C" and len(parts) == 8:
            pid, uid, fd = int(parts[1]), int(parts[2]), int(parts[3])
            family = int(parts[4])
            if family == 4:
                ip = format_ipv4(parts[5])
            elif family == 6:
                words = parts[5].split(":")
                if len(words) != 4:
                    return None
                ip = format_ipv6(words)
            else:
                return None
            return {
                "type": "connect",
                "pid": pid,
                "uid": uid,
                "fd": fd,
                "family": family,
                "ip": ip,
                "port": int(parts[6]),
                "comm": parts[7],
            }
        if kind == "U" and len(parts) == 8:
            pid, fd, family = int(parts[1]), int(parts[2]), int(parts[3])
            if family == 4:
                ip = format_ipv4(parts[4])
            elif family == 6:
                words = parts[4].split(":")
                if len(words) != 4:
                    return None
                ip = format_ipv6(words)
            else:
                return None
            return {
                "type": "udp",
                "pid": pid,
                "fd": fd,
                "family": family,
                "ip": ip,
                "port": int(parts[5]),
                "delta": int(parts[6]),
                "comm": parts[7],
            }
        if kind == "B" and len(parts) == 4:
            return {
                "type": "bytes",
                "pid": int(parts[1]),
                "fd": int(parts[2]),
                "delta": int(parts[3]),
            }
        if kind == "K" and len(parts) == 3:
            return {"type": "close", "pid": int(parts[1]), "fd": int(parts[2])}
        if kind == "E" and len(parts) == 3:
            return {"type": "exit", "pid": int(parts[1]), "tid": int(parts[2])}
        if kind == "P" and len(parts) == 6:
            return {
                "type": "payload",
                "pid": int(parts[1]),
                "fd": int(parts[2]),
                "nsecs": int(parts[3]),
                "length": int(parts[4]),
                "data": bytes.fromhex("".join(parts[5].split())),
            }
    except (ValueError, OSError):
        return None
    return None


def parse_map_line(line: str) -> dict | None:
    """把 interval 快照里的一行转成 bytes 事件。"""
    match = _MAP_BYTES.match(line.rstrip("\n"))
    if not match:
        return None
    pid, fd, delta = (int(item) for item in match.groups())
    if delta <= 0:
        return None
    return {"type": "bytes", "pid": pid, "fd": fd, "delta": delta}
