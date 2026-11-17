"""数据目录：默认 ~/.cache/netx；root 运行时按 SUDO_UID 落到该用户的家目录。"""

from __future__ import annotations

import fcntl
import os
import pwd
import sys
from pathlib import Path


def home() -> Path:
    """采集器用 sudo 起时，数据仍归调用者，不写进 root 的家目录。"""
    override = os.environ.get("NETX_HOME")
    if override:
        return Path(override)
    if os.geteuid() == 0:
        uid = os.environ.get("SUDO_UID")
        if uid:
            try:
                return Path(pwd.getpwuid(int(uid)).pw_dir)
            except (KeyError, ValueError):
                pass
    return Path.home()


def warn_root_home() -> None:
    """root 直开或 sudo -i 时拿不到 SUDO_UID，数据会落到 /root，先提醒一句。"""
    if os.geteuid() != 0:
        return
    if os.environ.get("SUDO_UID") or os.environ.get("NETX_HOME") or os.environ.get("NETX_DB"):
        return
    print(
        "netx: 没拿到 SUDO_UID，记录会写到 /root/.cache/netx；"
        "从普通用户用 sudo 启动，或设置 NETX_HOME 可避免。",
        file=sys.stderr,
    )


def cache_dir() -> Path:
    return home() / ".cache" / "netx"


def db_path() -> Path:
    return Path(os.environ.get("NETX_DB") or (cache_dir() / "netx.db"))


def log_path() -> Path:
    return cache_dir() / "collector.log"


def acquire_lock():
    """同一时间只让一个采集进程跑；拿不到返回 None，调用方退出。"""
    path = cache_dir() / "collector.lock"
    ensure_dir(path.parent)
    handle = open(path, "w")
    try:
        fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        handle.close()
        return None
    handle.write(str(os.getpid()))
    handle.flush()
    _chown(path)
    return handle


def ensure_dir(path: Path) -> Path:
    """只把本次新建的目录交给 sudo 调用者，已有的目录不碰。"""
    created = not path.exists()
    path.mkdir(parents=True, exist_ok=True)
    if created:
        _chown(path)
    return path


def _chown(path: Path) -> None:
    if os.geteuid() != 0:
        return
    if path.is_symlink():
        return
    uid = os.environ.get("SUDO_UID")
    gid = os.environ.get("SUDO_GID")
    if not uid:
        return
    try:
        os.chown(path, int(uid), int(gid) if gid else -1)
    except (OSError, ValueError):
        pass
