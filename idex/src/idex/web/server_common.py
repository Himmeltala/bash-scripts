# @Author: Himmeltala
# @Date: 2026-11-26 09:29:54
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-26 09:29:54
# @FilePath: \idex\src\idex\web\server_common.py
# @Description: 网页服务各路由共用的东西：文件大小上限、工作副本路径校验与写操作锁。

"""网页服务各路由共用的东西：文件大小上限、工作副本路径校验与写操作锁。"""

import sys
import threading
import time

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


# 页面日志存储由网页进程注入；引擎脚本单独运行时没有它。
_LOG_STORE = None


def set_log_store(store):
    global _LOG_STORE
    _LOG_STORE = store


def _level_of(msg):
    text = str(msg)
    if any(word in text for word in ("出错", "失败", "错误", "异常", "Traceback", "Error", "Exception")):
        return "error"
    if any(word in text for word in ("警告", "没有起来", "超时")):
        return "warning"
    return "info"


def log(msg, detail=""):
    print(time.strftime("%H:%M:%S"), msg, file=sys.stderr, flush=True)
    if _LOG_STORE is not None:
        try:
            _LOG_STORE.add(_level_of(msg), msg, detail, source="server")
        except Exception:
            pass

