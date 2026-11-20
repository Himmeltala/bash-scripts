"""工作副本变化与状态变化的推送：一个工作副本一个检查线程，页面断开就退出。"""

import queue
import threading
import time
from pathlib import Path

from server_common import log
from vcs_summary import (
    changes_signature,
)

# SSE 心跳：这段时间没有事件就发一行注释，别让中间设备把连接掐了。
SSE_HEARTBEAT = 15
# 工作副本的检查间隔。
WATCH_INTERVAL = 3
# 工作区列表这类轻量状态的检查间隔。
STATE_WATCH_INTERVAL = 0.5


class EventHub:
    """工作副本变化的订阅：一个工作副本一个检查线程，最后一个页面断开就退出。"""

    def __init__(self):
        self.lock = threading.Lock()
        self.subs = {}
        self.watchers = {}

    def subscribe(self, ws):
        box = queue.Queue(maxsize=200)
        wid = ws["id"]
        with self.lock:
            self.subs.setdefault(wid, set()).add(box)
            start = wid not in self.watchers
            if start:
                # 先占位，别的订阅者这时不会重复起检查线程。
                self.watchers[wid] = None
        if start:
            thread = threading.Thread(target=self._watch, args=(ws,), daemon=True)
            with self.lock:
                self.watchers[wid] = thread
            thread.start()
        return box

    def unsubscribe(self, wid, box):
        with self.lock:
            subs = self.subs.get(wid)
            if subs is not None:
                subs.discard(box)

    def broadcast(self, wid, event, data):
        with self.lock:
            boxes = list(self.subs.get(wid, ()))
        for box in boxes:
            try:
                box.put_nowait((event, data))
            except queue.Full:
                # 页面没跟上就丢掉这次提醒，下一次变化还会再提醒。
                pass

    def _watch(self, ws):
        wid = ws["id"]
        last = None
        last_revision = None
        while True:
            with self.lock:
                if not self.subs.get(wid):
                    self.subs.pop(wid, None)
                    self.watchers.pop(wid, None)
                    return
            try:
                signature, count, revision = changes_signature(ws)
            except Exception:
                signature, count, revision = None, 0, None
            # 第一次也推一次：连接建立前后刚发生的改动不会漏掉，页面重载一次无妨。
            if signature is not None and signature != last:
                self.broadcast(wid, "changes", {"ws": wid, "count": count})
            if signature is not None:
                last = signature
            # 版本变了说明外面提交或更新过，日志与同步页也要重读。
            if revision is not None and revision != last_revision:
                self.broadcast(wid, "head", {"ws": wid, "revision": revision})
            if revision is not None:
                last_revision = revision
            time.sleep(WATCH_INTERVAL)


class StateStream:
    """登记表一变就推一份给所有页面；页面不用再定时来取。"""

    def __init__(self, paths, build):
        # 登记表与分组结构各一个文件，哪个变了都推一份；只给一个路径也照收。
        if isinstance(paths, (str, Path)):
            paths = [paths]
        self.paths = [Path(p) for p in paths]
        self.build = build
        self.lock = threading.Lock()
        self.subs = set()
        self.payload = None

    def start(self):
        threading.Thread(target=self._run, daemon=True).start()

    def subscribe(self):
        box = queue.Queue(maxsize=1)
        with self.lock:
            self.subs.add(box)
            if self.payload is not None:
                box.put_nowait(self.payload)
        return box

    def unsubscribe(self, box):
        with self.lock:
            self.subs.discard(box)

    def _publish(self, payload):
        with self.lock:
            self.payload = payload
            subs = list(self.subs)
        for box in subs:
            if box.full():
                try:
                    box.get_nowait()
                except queue.Empty:
                    pass
            try:
                box.put_nowait(payload)
            except queue.Full:
                pass

    def _mtimes(self):
        out = []
        for path in self.paths:
            try:
                out.append(path.stat().st_mtime_ns)
            except OSError:
                out.append(None)
        return tuple(out)

    def _run(self):
        seen = None
        while True:
            mtimes = self._mtimes()
            if mtimes != seen:
                seen = mtimes
                try:
                    self._publish(self.build())
                except Exception as exc:
                    log("取工作区列表失败：%r" % exc)
            time.sleep(STATE_WATCH_INTERVAL)


HUB = EventHub()

