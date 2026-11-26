# @Author: Himmeltala
# @Date: 2026-11-26 09:29:54
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-26 09:29:54
# @FilePath: \idex\src\idex\web\event_hub.py
# @Description: 工作副本变化与状态变化的推送：一个工作副本一个检查线程，页面断开就退出。

"""工作副本变化与状态变化的推送：一个工作副本一个检查线程，页面断开就退出。"""

import queue
import threading
import time

from sse import StateStream

from vcs_summary import (
    changes_report,
)

# SSE 心跳：这段时间没有事件就发一行注释，别让中间设备把连接掐了。
SSE_HEARTBEAT = 15
# 工作副本的检查间隔。
WATCH_INTERVAL = 3


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
                signature, count, revision, paths = changes_report(ws)
            except Exception:
                signature, count, revision, paths = None, 0, None, []
            # 第一次也推一次：连接建立前后刚发生的改动不会漏掉，页面重载一次无妨。
            if signature is not None and signature != last:
                self.broadcast(wid, "changes", {"ws": wid, "count": count, "paths": paths})
            if signature is not None:
                last = signature
            # 版本变了说明外面提交或更新过，日志与同步页也要重读。
            if revision is not None and revision != last_revision:
                self.broadcast(wid, "head", {"ws": wid, "revision": revision})
            if revision is not None:
                last_revision = revision
            time.sleep(WATCH_INTERVAL)


HUB = EventHub()

