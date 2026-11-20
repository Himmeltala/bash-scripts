"""后台写操作：任务对象、任务表与执行线程。"""

import os
import signal
import subprocess
import threading
import time
import uuid

# 单条命令最长跑多久，超时整组进程收到 TERM。
OPERATION_TIMEOUT = 300
# 任务结束后还留多久，供页面刷新时接上输出。
JOB_KEEP = 600
# 一次任务最多留这么多行输出。
JOB_LINES_MAX = 20000


def terminate_process(proc):
    """先礼后兵：整个进程组收到 TERM，等 5 秒还不走就 KILL。"""
    if proc.poll() is not None:
        return
    try:
        os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
    except OSError:
        try:
            proc.terminate()
        except OSError:
            pass
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
        except OSError:
            try:
                proc.kill()
            except OSError:
                pass


class Job:
    """一次写操作：命令在后台跑，输出先攒着，SSE 连接随时可以来读。"""

    def __init__(self, ws_id, action, commands, cwd, env, command):
        self.id = uuid.uuid4().hex[:12]
        self.ws_id = ws_id
        self.action = action
        self.commands = commands
        self.cwd = cwd
        self.env = env
        self.command = command
        self.status = "queued"
        self.ok = None
        self.error = ""
        self.output = []
        self.done = False
        self.cancel_requested = False
        self.timed_out = False
        self.proc = None
        self.started = time.time()
        self.ended = None
        self.cond = threading.Condition()

    def append(self, line):
        with self.cond:
            self.output.append(line)
            if len(self.output) > JOB_LINES_MAX:
                del self.output[: len(self.output) - JOB_LINES_MAX]
            # 输出太多时只留最近这些行，重连后从头读也只会读到这一截。
            self.cond.notify_all()

    def finish(self, status, ok, error):
        with self.cond:
            self.status = status
            self.ok = ok
            self.error = error
            self.ended = time.time()
            self.done = True
            self.cond.notify_all()

    def cancel(self):
        with self.cond:
            if self.done:
                return
            self.cancel_requested = True
            proc = self.proc
            self.cond.notify_all()
        if proc is not None:
            terminate_process(proc)

    def _snapshot(self):
        """调用方已经持有 cond 时用这一份，避免重复加锁。"""
        return {
            "id": self.id,
            "ws": self.ws_id,
            "action": self.action,
            "command": self.command,
            "status": self.status,
            "ok": self.ok,
            "error": self.error,
            "done": self.done,
            "started": self.started,
            "ended": self.ended,
            "output": "\n".join(self.output),
        }

    def snapshot(self):
        with self.cond:
            return self._snapshot()


class Jobs:
    def __init__(self):
        self.lock = threading.Lock()
        self.items = {}

    def add(self, job):
        with self.lock:
            self._prune()
            self.items[job.id] = job

    def get(self, job_id):
        with self.lock:
            self._prune()
            return self.items.get(job_id)

    def latest(self, ws_id):
        """这个工作副本最近一次任务；页面刷新后靠它接上还在跑的操作。"""
        with self.lock:
            self._prune()
            jobs = [job for job in self.items.values() if job.ws_id == ws_id]
            if not jobs:
                return None
            return max(jobs, key=lambda job: job.started)

    def _prune(self):
        now = time.time()
        dead = [
            key
            for key, job in self.items.items()
            if job.done and job.ended and now - job.ended > JOB_KEEP
        ]
        for key in dead:
            self.items.pop(key, None)


def run_job(job, lock, hub):
    """后台跑一串写操作，逐行攒输出，结束后放开工作副本锁并通知页面刷新。"""
    timer = None
    current = None
    rc = 0
    try:
        with job.cond:
            job.status = "running"
            job.cond.notify_all()

        def on_timeout():
            job.timed_out = True
            if current is not None:
                terminate_process(current)

        timer = threading.Timer(OPERATION_TIMEOUT, on_timeout)
        timer.daemon = True
        timer.start()

        for argv in job.commands:
            if job.cancel_requested or job.timed_out:
                break
            proc = subprocess.Popen(
                argv,
                cwd=job.cwd,
                env=job.env,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                bufsize=1,
                start_new_session=True,
            )
            current = proc
            with job.cond:
                job.proc = proc
                cancelled = job.cancel_requested
            if cancelled:
                terminate_process(proc)
            if proc.stdout is not None:
                for line in proc.stdout:
                    job.append(line.rstrip("\r\n"))
            rc = proc.wait()
            if rc != 0:
                break

        # 命令刚跑完就走到这里，先把超时定时器停掉，别让它把成功翻成超时。
        if timer is not None:
            timer.cancel()
        if job.cancel_requested:
            job.finish("cancelled", False, "操作已取消")
        elif job.timed_out:
            job.finish("failed", False, "命令超过 %d 秒，已终止" % OPERATION_TIMEOUT)
        else:
            job.finish(
                "done" if rc == 0 else "failed",
                rc == 0,
                "" if rc == 0 else "命令退出码 %d" % rc,
            )
    except Exception as exc:
        job.finish("failed", False, "执行出错：%s" % exc)
    finally:
        if timer is not None:
            timer.cancel()
        try:
            lock.release()
        except RuntimeError:
            pass
        hub.broadcast(job.ws_id, "repo", {"action": job.action, "ok": job.ok})


JOBS = Jobs()

