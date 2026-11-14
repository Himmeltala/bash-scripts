"""SSE 相关的公共件：行缓冲、尾部补发、一份数据推给所有页面。"""

import codecs
import json
import os
import queue
import threading
import time
from pathlib import Path

from runner import run_info, run_log_path
from web import ApiError, log

# 日志尾部一页的行数。
LOG_PAGE = 400
# 闲太久发一条注释，免得代理把连接当死链掐掉。
SSE_PING_SECONDS = 15
# 所有 SSE 推送的默认间隔：5 秒一份。
SSE_INTERVAL = 5.0
# 指标栏按这个节奏推；前端照着存点，60 个点正好覆盖 5 分钟。
METRICS_STREAM_INTERVAL = SSE_INTERVAL
# 页面连着时按这个间隔收拾运行记录；文件有变化就推，最多晚半秒。
STATE_TICK_INTERVAL = 2.0
PUMP_INTERVAL = 0.5


class LineBuffer:
    """把字节流按行切开；末尾没写完的行留到下一次，跨块的多字节字符也不会切坏。"""

    def __init__(self):
        self._decoder = codecs.getincrementaldecoder("utf-8")("replace")
        self._pending = ""

    def feed(self, data):
        self._pending += self._decoder.decode(data)
        if "\n" not in self._pending:
            return ""
        *lines, self._pending = self._pending.split("\n")
        return "\n".join(lines)

    def flush(self):
        text = self._pending + self._decoder.decode(b"", final=True)
        self._pending = ""
        return text


def last_lines(data, lines=LOG_PAGE):
    """日志尾部一页：返回 (文本, 还有更早的没有)。"""
    all_lines = data.decode("utf-8", "replace").splitlines()
    return "\n".join(all_lines[-lines:]), len(all_lines) > lines


def sse_data(payload, event=None, event_id=None, json_default=None):
    """一条 SSE 事件。数据整体走 JSON，换行不会破坏 data 行的格式。"""
    head = ""
    if event_id is not None:
        head += "id: %s\n" % event_id
    if event:
        head += "event: %s\n" % event
    if json_default is None:
        data = json.dumps(payload, ensure_ascii=False)
    else:
        data = json.dumps(payload, ensure_ascii=False, default=json_default)
    return head + "data: " + data + "\n\n"


def sse_event(text, event=None, event_id=None, more=None):
    payload = {"text": text}
    if more is not None:
        payload["more"] = bool(more)
    return sse_data(payload, event=event, event_id=event_id)


def tail(path, page=0, lines=LOG_PAGE):
    """日志的一页：page=0 最新，page=n 再往前翻 n 页。返回 (文本, 还有更早的没有)。"""
    try:
        data = Path(path).read_bytes()
    except OSError:
        return "", False
    all_lines = data.decode("utf-8", "replace").splitlines()
    end = max(0, len(all_lines) - page * lines)
    start = max(0, end - lines)
    return "\n".join(all_lines[start:end]), start > 0


def log_page(state, logs, query, run_kind="run"):
    """日志界面的一页：runid 与 page 从 query 取，状态行只用来带出状态与退出码。"""
    runid = (query.get("run") or [""])[0]
    run = state.find(run_kind, runid)
    try:
        page = max(0, int((query.get("page") or ["0"])[0] or 0))
    except ValueError:
        page = 0
    text, more = tail(run_log_path(logs, runid), page)
    info = run_info(run) if run else {}
    return {
        "run": runid,
        "status": info.get("status", ""),
        "code": info.get("code", ""),
        "text": text,
        "page": page,
        "more": more,
    }


class Fanout:
    """一份数据推给所有页面；来不及取的只留最新的一份。"""

    def __init__(self):
        self._lock = threading.Lock()
        self._subs = set()
        self._payload = None

    def subscribe(self):
        q = queue.Queue(maxsize=1)
        with self._lock:
            self._subs.add(q)
            if self._payload is not None:
                q.put_nowait(self._payload)
        return q

    def unsubscribe(self, q):
        with self._lock:
            self._subs.discard(q)

    def listeners(self):
        with self._lock:
            return len(self._subs)

    def publish(self, payload):
        with self._lock:
            self._payload = payload
            subs = list(self._subs)
        for q in subs:
            if q.full():
                try:
                    q.get_nowait()
                except queue.Empty:
                    pass
            try:
                q.put_nowait(payload)
            except queue.Full:
                pass


class StateStream(Fanout):
    """状态文件一变就推一份；tick 也走这条线程，开几个页面都只跑一条。"""

    def __init__(self, paths, build, tick, pump=PUMP_INTERVAL, tick_interval=STATE_TICK_INTERVAL):
        super().__init__()
        self.paths = [Path(p) for p in paths]
        self.build = build
        self.tick = tick
        self.pump = pump
        self.tick_interval = tick_interval

    def start(self):
        threading.Thread(target=self._run, daemon=True).start()

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
        next_tick = 0.0
        while True:
            # 没有页面连着就不收拾，和以前没人轮询时一样。
            if not self.listeners():
                seen = None
                time.sleep(self.pump)
                continue
            now = time.time()
            if now >= next_tick:
                next_tick = now + self.tick_interval
                try:
                    self.tick()
                except ApiError as exc:
                    log("tick 失败：%s" % exc.message)
                except Exception as exc:
                    log("tick 出错：%r" % exc)
            mtimes = self._mtimes()
            if mtimes != seen:
                seen = mtimes
                try:
                    self.publish(self.build())
                except Exception as exc:
                    log("状态推送失败：%r" % exc)
            time.sleep(self.pump)


class MetricsStream(Fanout):
    """指标只采一份给所有页面，CPU 的两次采样之间不会被别的页面抢走。"""

    def __init__(self, metrics, pump=PUMP_INTERVAL, interval=METRICS_STREAM_INTERVAL):
        super().__init__()
        self.metrics = metrics
        self.pump = pump
        self.interval = interval

    def start(self):
        threading.Thread(target=self._run, daemon=True).start()

    def _run(self):
        last = 0.0
        while True:
            if not self.listeners():
                last = 0.0
                time.sleep(self.pump)
                continue
            if time.time() - last >= self.interval:
                last = time.time()
                try:
                    self.publish(self.metrics.snapshot())
                except Exception as exc:
                    log("指标推送失败：%r" % exc)
            time.sleep(self.pump)


class SSEMixin:
    """页面长连接的公共写法；子类提供 logs（运行日志目录）等属性。"""

    def _sse_start(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "close")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()
        self.close_connection = True

    def _sse(self, streams):
        """一条长连接带几路数据：哪路有新的一份就写哪路，闲久了 ping 一下。"""
        streams = [(stream, event) for stream, event in streams if stream is not None]
        if not streams:
            raise ApiError(503, "推送没有起来")
        self._sse_start()
        subs = [(event, stream, stream.subscribe()) for stream, event in streams]
        last = time.time()
        try:
            while True:
                wrote = False
                for event, _, q in subs:
                    try:
                        payload = q.get_nowait()
                    except queue.Empty:
                        continue
                    self.wfile.write(sse_data(payload, event=event).encode("utf-8"))
                    self.wfile.flush()
                    wrote = True
                now = time.time()
                if wrote:
                    last = now
                elif now - last >= SSE_PING_SECONDS:
                    self.wfile.write(b": ping\n\n")
                    self.wfile.flush()
                    last = now
                else:
                    time.sleep(PUMP_INTERVAL)
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            for _, stream, q in subs:
                stream.unsubscribe(q)

    def _stream_log(self, runid):
        """把日志按 SSE 推给页面：先补最近一页，再推新写入的行。"""
        if not runid:
            raise ApiError(400, "没给运行号")
        logs = Path(self.logs).resolve()
        path = logs / runid.split(".", 1)[0] / (runid + ".log")
        try:
            path.resolve().relative_to(logs)
        except ValueError:
            raise ApiError(400, "运行号不对")

        # 断线重连时浏览器会带上 Last-Event-ID，从那里接着推，不重发历史。
        try:
            offset = int(self.headers.get("Last-Event-ID", ""))
        except ValueError:
            offset = None

        self._sse_start()

        buf = LineBuffer()
        last_write = time.time()
        fh = None
        exited = False
        try:
            while True:
                if fh is None:
                    try:
                        fh = open(path, "rb")
                    except OSError:
                        fh = None
                if fh is not None:
                    size = os.fstat(fh.fileno()).st_size
                    if offset is None or size < offset:
                        # 第一次连上，或者文件被重写：先补尾部。
                        with open(path, "rb") as rf:
                            data = rf.read()
                        text, more = last_lines(data)
                        offset = len(data)
                        buf = LineBuffer()
                        self.wfile.write(sse_event(text, event="tail", event_id=offset, more=more).encode("utf-8"))
                        self.wfile.flush()
                        last_write = time.time()
                    else:
                        fh.seek(offset)
                        chunk = fh.read()
                        if chunk:
                            offset += len(chunk)
                            text = buf.feed(chunk)
                            if text:
                                self.wfile.write(sse_event(text, event="append", event_id=offset).encode("utf-8"))
                                self.wfile.flush()
                                last_write = time.time()
                    # Sessions 退出后把退出码写在日志旁边；发一次就够。
                    # 压缩任务靠它收尾，普通服务日志忽略这个事件。
                    if not exited:
                        try:
                            code = int(Path(str(path) + ".code").read_text(encoding="utf-8").strip())
                        except (OSError, ValueError):
                            pass
                        else:
                            exited = True
                            self.wfile.write(sse_data({"code": code}, event="exit", event_id=offset).encode("utf-8"))
                            self.wfile.flush()
                            last_write = time.time()
                if time.time() - last_write >= 5:
                    self.wfile.write(b": ping\n\n")
                    self.wfile.flush()
                    last_write = time.time()
                time.sleep(0.25)
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            if fh is not None:
                fh.close()
