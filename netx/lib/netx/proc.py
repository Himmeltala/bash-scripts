"""从 /proc 补齐事件里没有的进程信息。"""

from __future__ import annotations

import os
from pathlib import Path


def info(pid: int) -> dict:
    """comm 与 uid 拿不到时返回空，调用方用事件里的值兜底。"""
    base = Path("/proc") / str(pid)
    comm = ""
    try:
        comm = (base / "comm").read_text(encoding="utf-8", errors="replace").strip()
    except OSError:
        pass
    exe = ""
    try:
        exe = os.readlink(base / "exe")
    except OSError:
        pass
    uid = -1
    try:
        uid = base.stat().st_uid
    except OSError:
        pass
    return {"comm": comm, "exe": exe, "uid": uid}
