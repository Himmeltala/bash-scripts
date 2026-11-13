"""家目录内的目录浏览：给选目录用的那一层。"""

import os
from pathlib import Path

from web import ApiError

# 一次最多回多少子目录：家目录之外也可能有几千项的目录，超过就截断并告诉页面。
MAX_DIRS = 1000


def inside(path, home):
    return path == home or home in path.parents


def is_dir_entry(entry, home):
    """这一项算不算能进的家目录子目录：符号链接要落到家目录里面才算。"""
    try:
        if entry.is_symlink():
            real = Path(entry.path).resolve()
            return inside(real, home) and real.is_dir()
        return entry.is_dir(follow_symlinks=False)
    except OSError:
        return False


def list_dirs(raw):
    """列家目录内某一层的子目录；空路径就是家目录本身。"""
    home = Path.home().resolve()
    text = (raw or "").strip()
    target = Path(os.path.expanduser(text)) if text else home
    if not target.is_absolute():
        target = home / target
    try:
        target = target.resolve()
    except OSError as exc:
        raise ApiError(400, "解析目录失败：%s" % exc)
    if not inside(target, home):
        raise ApiError(400, "只能浏览家目录内的目录：%s" % home)
    if not target.is_dir():
        raise ApiError(400, "不是目录：%s" % text)

    entries = []
    truncated = False
    try:
        with os.scandir(target) as it:
            for entry in it:
                if entry.name.startswith("."):
                    continue
                if not is_dir_entry(entry, home):
                    continue
                entries.append({"name": entry.name, "path": str(Path(entry.path))})
                if len(entries) >= MAX_DIRS:
                    truncated = True
                    break
    except PermissionError:
        raise ApiError(403, "没有权限读取：%s" % target)
    except OSError as exc:
        raise ApiError(400, "读取目录失败：%s" % exc)
    entries.sort(key=lambda item: item["name"].casefold())

    return {
        "home": str(home),
        "path": str(target),
        "parent": None if target == home else str(target.parent),
        "entries": entries,
        "truncated": truncated,
    }
