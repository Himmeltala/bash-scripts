"""SSE 推送接口：工作区列表、指标、单个工作副本的变化与任务输出。"""

import json
import queue
import time

from web import ApiError
from event_hub import HUB, SSE_HEARTBEAT
from jobs import JOBS


class StreamRoutes:
    """路由表里几条 /stream 与任务事件的实现，靠 MRO 混进 Handler。"""

    def _sse_headers(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "close")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()
        self.close_connection = True

    def _sse_write(self, text):
        try:
            self.wfile.write(text.encode("utf-8"))
            self.wfile.flush()
            return True
        except (BrokenPipeError, ConnectionResetError, OSError):
            return False

    def _sse_send(self, event, data):
        return self._sse_write("event: %s\ndata: %s\n\n" % (event, data))

    def _sse_ping(self):
        return self._sse_write(": ping\n\n")

    def _sse_state(self):
        stream = self.state_stream
        if stream is None:
            raise ApiError(503, "推送没有起来")
        box = stream.subscribe()
        try:
            try:
                self._sse_headers()
            except OSError:
                return
            while True:
                try:
                    payload = box.get(timeout=SSE_HEARTBEAT)
                except queue.Empty:
                    if not self._sse_ping():
                        return
                    continue
                if not self._sse_send("state", json.dumps(payload, ensure_ascii=False)):
                    return
        finally:
            stream.unsubscribe(box)

    def _sse_metrics(self):
        stream = self.metrics_stream
        if stream is None:
            raise ApiError(503, "指标推送没有起来")
        box = stream.subscribe()
        try:
            try:
                self._sse_headers()
            except OSError:
                return
            while True:
                try:
                    payload = box.get(timeout=SSE_HEARTBEAT)
                except queue.Empty:
                    if not self._sse_ping():
                        return
                    continue
                if not self._sse_send("metrics", json.dumps(payload, ensure_ascii=False)):
                    return
        finally:
            stream.unsubscribe(box)

    def _sse_workspace(self, query):
        ws = self._ws(query)
        box = HUB.subscribe(ws)
        try:
            try:
                self._sse_headers()
            except OSError:
                return
            if not self._sse_send("ready", json.dumps({"ws": ws["id"]}, ensure_ascii=False)):
                return
            while True:
                try:
                    event, data = box.get(timeout=SSE_HEARTBEAT)
                except queue.Empty:
                    if not self._sse_ping():
                        return
                    continue
                if not self._sse_send(event, json.dumps(data, ensure_ascii=False)):
                    return
        finally:
            HUB.unsubscribe(ws["id"], box)

    def _sse_job(self, job_id):
        job = JOBS.get(job_id)
        if job is None:
            raise ApiError(404, "没有这个任务")
        try:
            self._sse_headers()
        except OSError:
            return
        index = 0
        last_ping = time.monotonic()
        while True:
            with job.cond:
                lines = job.output[index:]
                index = len(job.output)
                snapshot = job._snapshot()
            for line in lines:
                if not self._sse_send("output", json.dumps({"line": line}, ensure_ascii=False)):
                    return
            if snapshot["done"]:
                # 输出已经逐行发过，结束事件只带状态，避免整份输出再来一遍。
                done = {key: value for key, value in snapshot.items() if key != "output"}
                self._sse_send("done", json.dumps(done, ensure_ascii=False))
                return
            with job.cond:
                job.cond.wait(timeout=SSE_HEARTBEAT)
            if time.monotonic() - last_ping >= SSE_HEARTBEAT:
                if not self._sse_ping():
                    return
                last_ping = time.monotonic()

