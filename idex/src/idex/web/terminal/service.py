# @Author: Himmeltala
# @Date: 2026-11-26 09:29:54
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-26 09:29:54
# @FilePath: \idex\src\idex\web\terminal\service.py
# @Description: 工作区终端会话：一条会话一个 PTY，输出按序号缓存，客户端确认后回收。

import fcntl
import os
import pty
import select
import signal
import struct
import termios
import threading
import time
from collections import deque

MAX_PER_WS = 5
MAX_TOTAL = 20
# 一次系统调用读这么多；读完先看 PTY 还有没有现成数据，攒成一批再发，少切帧。
READ_SIZE = 64 * 1024
# 一批最多攒这么多字节，防止一条命令的输出无限占住读线程。
BATCH_LIMIT = 256 * 1024
# 未确认输出超过这个量就暂停读 PTY，等客户端 ack 再继续，终端不会把内存吃满。
SOFT_BUFFER = 1024 * 1024
# 没有客户端看时只留最近这一段，换回来还能看到最近的屏幕内容。
IDLE_BUFFER = 256 * 1024
IDLE_SECONDS = 30 * 60


class TerminalSession:
    """一条 shell 会话：读写同一个 PTY，输出带序号缓存。"""

    def __init__(self, ws_id, root, cols=100, rows=30):
        self.id = os.urandom(8).hex()
        self.ws_id = ws_id
        self.root = root
        self.cols = cols
        self.rows = rows
        self.lock = threading.Condition()
        self.subscribers = set()
        self.chunks = deque()
        self.buffered = 0
        self.seq = 0
        self.acked = 0
        self.done = False
        self.closed = False
        self.started = time.monotonic()
        self.last_active = time.monotonic()

        shell = os.environ.get("SHELL") or "/bin/bash"
        pid, fd = pty.fork()
        if pid == 0:  # 子进程：换了控制终端后直接 exec，不再碰 Python 锁。
            try:
                os.chdir(root)
                env = dict(os.environ)
                env.update({"TERM": "xterm-256color", "COLORTERM": "truecolor"})
                os.execvpe(shell, [shell, "-l"], env)
            except Exception:
                os._exit(127)
        self.pid = pid
        self.fd = fd
        self.shell = os.path.basename(shell) or "shell"
        self.resize(cols, rows)
        threading.Thread(target=self._pump, name="idex-term-%s" % self.id, daemon=True).start()

    def _pump(self):
        while not self.closed:
            with self.lock:
                while self.buffered > SOFT_BUFFER and not self.closed:
                    self.lock.wait(timeout=1)
            try:
                ready, _, _ = select.select([self.fd], [], [], 1)
            except (OSError, ValueError):
                break
            if not ready:
                continue
            # 先把 PTY 里现成可读的数据攒成一批，再按一个序号发出去。
            batch = bytearray()
            eof = False
            try:
                while len(batch) < BATCH_LIMIT:
                    data = os.read(self.fd, min(READ_SIZE, BATCH_LIMIT - len(batch)))
                    if not data:
                        eof = True
                        break
                    batch.extend(data)
                    more, _, _ = select.select([self.fd], [], [], 0)
                    if not more:
                        break
            except (OSError, ValueError):
                eof = True
            if batch:
                self._append(bytes(batch))
            if eof:
                break
        # shell 自己退出时顺手收掉进程，别把僵尸留到空闲回收。
        try:
            os.waitpid(self.pid, os.WNOHANG)
        except ChildProcessError:
            pass
        self._finish()

    def _append(self, data):
        with self.lock:
            if self.closed:
                return
            self.seq += 1
            self.chunks.append((self.seq, data))
            self.buffered += len(data)
            self.last_active = time.monotonic()
            listeners = list(self.subscribers)
            # 没人看就只留最近一段，别让后台终端的缓冲一直涨到软上限。
            if not listeners:
                self._trim(IDLE_BUFFER)
            self.lock.notify_all()
        for box in listeners:
            try:
                box.put_nowait((self.seq, data))
            except Exception:
                pass

    def _finish(self):
        with self.lock:
            if self.done:
                return
            self.done = True
            listeners = list(self.subscribers)
            self.lock.notify_all()
        for box in listeners:
            try:
                box.put_nowait(None)
            except Exception:
                pass

    def subscribe(self):
        import queue

        box = queue.Queue()
        with self.lock:
            self.subscribers.add(box)
            if len(self.subscribers) == 1:
                self.last_active = time.monotonic()
        return box

    def unsubscribe(self, box):
        with self.lock:
            self.subscribers.discard(box)
            if not self.subscribers:
                self._trim(IDLE_BUFFER)
            self.lock.notify_all()

    def _trim(self, limit):
        while self.buffered > limit and self.chunks:
            _, old = self.chunks.popleft()
            self.buffered -= len(old)

    def ack(self, seq):
        with self.lock:
            self.acked = max(self.acked, int(seq))
            while self.chunks and self.chunks[0][0] <= self.acked:
                _, old = self.chunks.popleft()
                self.buffered -= len(old)
            self.lock.notify_all()

    def chunks_since(self, since):
        with self.lock:
            return [(seq, data) for seq, data in self.chunks if seq > since]

    def write(self, data):
        if not data or self.closed:
            return False
        try:
            os.write(self.fd, data)
            with self.lock:
                self.last_active = time.monotonic()
            return True
        except OSError:
            return False

    def resize(self, cols, rows):
        self.cols = max(20, min(int(cols), 400))
        self.rows = max(5, min(int(rows), 200))
        try:
            fcntl.ioctl(self.fd, termios.TIOCSWINSZ, struct.pack("HHHH", self.rows, self.cols, 0, 0))
        except OSError:
            pass

    def close(self):
        if self.closed:
            return
        self.closed = True
        try:
            os.killpg(self.pid, signal.SIGTERM)
        except OSError:
            pass
        deadline = time.monotonic() + 1
        while time.monotonic() < deadline:
            try:
                if os.waitpid(self.pid, os.WNOHANG)[0]:
                    break
            except ChildProcessError:
                break
            time.sleep(0.05)
        else:
            try:
                os.killpg(self.pid, signal.SIGKILL)
            except OSError:
                pass
            try:
                os.waitpid(self.pid, 0)
            except ChildProcessError:
                pass
        try:
            os.close(self.fd)
        except OSError:
            pass
        self._finish()


class TerminalManager:
    """按工作区分组的多会话管理；空闲会话定时回收。"""

    def __init__(self):
        self.lock = threading.Lock()
        self.sessions = {}
        self.by_ws = {}
        # 正在锁外建的会话：先占名额，别让并发创建冲破总数上限。
        self.reserved = 0
        self.sweeper = threading.Thread(target=self._sweep, name="idex-term-sweep", daemon=True)
        self.sweeper.start()

    def _sweep(self):
        while True:
            time.sleep(60)
            now = time.monotonic()
            with self.lock:
                stale = [
                    item
                    for item in self.sessions.values()
                    if (item.done or not item.subscribers) and now - item.last_active > IDLE_SECONDS
                ]
            for item in stale:
                self.close(item.id)

    # pty.fork 会复制整个进程地址空间，放到管理器锁外做，别的会话操作不被它卡住。
    def create(self, ws_id, root, cols=100, rows=30):
        with self.lock:
            ids = self.by_ws.setdefault(ws_id, [])
            if len(ids) + 1 > MAX_PER_WS:
                raise ValueError("这个工作区打开的终端太多了，先关掉几个")
            if len(self.sessions) + self.reserved >= MAX_TOTAL:
                raise ValueError("服务端终端数量到上限了，先关掉几个")
            self.reserved += 1
        try:
            session = TerminalSession(ws_id, root, cols, rows)
        except Exception:
            with self.lock:
                self.reserved -= 1
                if not self.by_ws.get(ws_id):
                    self.by_ws.pop(ws_id, None)
            raise
        with self.lock:
            self.reserved -= 1
            ids = self.by_ws.setdefault(ws_id, [])
            # 建的过程中同组可能又开了终端，撞上限就把这个新的收掉。
            if len(ids) >= MAX_PER_WS:
                error = "这个工作区打开的终端太多了，先关掉几个"
            elif len(self.sessions) >= MAX_TOTAL:
                error = "服务端终端数量到上限了，先关掉几个"
            else:
                error = ""
                ids.append(session.id)
                self.sessions[session.id] = session
        if error:
            session.close()
            raise ValueError(error)
        return session

    def get(self, session_id):
        with self.lock:
            return self.sessions.get(session_id)

    def list(self, ws_id):
        with self.lock:
            ids = list(self.by_ws.get(ws_id, []))
        out = []
        for session_id in ids:
            session = self.get(session_id)
            if session is None:
                continue
            out.append(
                {
                    "id": session.id,
                    "title": session.shell,
                    "cols": session.cols,
                    "rows": session.rows,
                    "done": session.done,
                    "started": int(session.started),
                }
            )
        return out

    def close(self, session_id):
        with self.lock:
            session = self.sessions.pop(session_id, None)
            if session is None:
                return False
            ids = self.by_ws.get(session.ws_id, [])
            if session_id in ids:
                ids.remove(session_id)
            if not ids:
                self.by_ws.pop(session.ws_id, None)
        session.close()
        return True

    def close_all(self):
        with self.lock:
            sessions = list(self.sessions.values())
            self.sessions.clear()
            self.by_ws.clear()
        for session in sessions:
            session.close()
