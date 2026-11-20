"""网页服务各路由共用的东西：文件大小上限、工作副本路径校验与写操作锁。"""

import threading

from web import ApiError
from pathutil import PathError, safe_relative, within

# 单个文件的读取上限：超过它的文件不给看，只给下载。
MAX_FILE = 512 * 1024

# 同一个工作副本同时只跑一个写操作，避免两次提交或一次更新与一次提交撞在一起。
_WS_LOCKS = {}
_WS_LOCKS_GUARD = threading.Lock()


def workspace_lock(wid):
    with _WS_LOCKS_GUARD:
        return _WS_LOCKS.setdefault(wid, threading.Lock())


def safe_rel(rel):
    """接口收到的工作副本内相对路径：不许绝对路径，不许用 .. 跳出工作副本。"""
    try:
        return safe_relative(rel, "文件路径")
    except PathError:
        rel = (rel or "").strip()
        if not rel:
            raise ApiError(400, "没给文件路径")
        raise ApiError(400, "路径要在工作副本里：%s" % rel)


def inside(root, target):
    return within(target, root)
