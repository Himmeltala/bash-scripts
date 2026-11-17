"""bpftrace 采集进程的看护：读行事件、喂给 tracker、退出后重启。"""

from __future__ import annotations

import os
import secrets
import subprocess
import threading
import time
from pathlib import Path

from . import events, paths

SCRIPT = Path(__file__).resolve().parent / "bpf" / "collect.bt"
# 脚本里的占位符，启动前换成这一轮的随机前缀。
NONCE_PLACEHOLDER = "__NETX_NONCE__"


class Collector:
    """采集要 root，这里不做权限判断，由命令行入口负责。"""

    def __init__(
        self,
        db,
        tracker,
        *,
        bpftrace: str = "bpftrace",
        script: Path = SCRIPT,
        command: list[str] | None = None,
        log_file: Path | None = None,
        restart_delay: float = 2.0,
        clock=time.time,
        nonce: str | None = None,
    ):
        self.db = db
        self.tracker = tracker
        # 每轮采集带一个随机前缀：进程名里夹换行也伪造不出别的行。
        self.nonce = nonce or secrets.token_hex(8)
        self.log_file = Path(log_file) if log_file else paths.log_path()
        self.command = command or [bpftrace, "-q", str(self._render_script(script))]
        self.restart_delay = restart_delay
        self.clock = clock

        self._state = "stopped"
        self._error = ""
        self._proc = None
        self._thread = None
        self._sweeper = None
        self._stop = threading.Event()
        self._last_event = 0.0
        self._last_meta = 0.0

    def start(self) -> None:
        if self._thread is not None and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._run, name="netx-collector", daemon=True)
        self._thread.start()
        self._sweeper = threading.Thread(target=self._sweep, name="netx-sweeper", daemon=True)
        self._sweeper.start()

    def _sweep(self) -> None:
        """退出进程的尾巴与超时连接，靠这条线程按秒收。"""
        while not self._stop.wait(2.0):
            try:
                self.tracker.tick()
            except Exception:
                pass

    def stop(self, timeout: float = 5.0) -> None:
        self._stop.set()
        proc = self._proc
        if proc is not None and proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                proc.kill()
        if self._thread is not None:
            self._thread.join(timeout=timeout)
        if self._sweeper is not None:
            self._sweeper.join(timeout=timeout)
        self.tracker.close_all()
        self._set_state("stopped")

    def status(self) -> dict:
        return {
            "state": self._state,
            "pid": self._proc.pid if self._proc is not None and self._proc.poll() is None else 0,
            "last_event_at": self._last_event,
            "error": self._error,
        }

    def _set_state(self, state: str, error: str = "") -> None:
        self._state = state
        self._error = error
        try:
            self.db.set_meta("collector_state", state)
            self.db.set_meta("collector_error", error)
            self.db.set_meta("collector_pid", str(self.status()["pid"]))
        except Exception:
            pass

    def _render_script(self, template: Path) -> Path:
        """把随机前缀写死进脚本：str($1) 要占满 BPF 栈，字符串上限就提不上去。"""
        text = Path(template).read_text(encoding="utf-8")
        if NONCE_PLACEHOLDER not in text:
            raise ValueError("%s 里没有 %s 占位符" % (template, NONCE_PLACEHOLDER))
        target = paths.ensure_dir(self.log_file.parent) / "collect.bt"
        target.write_text(text.replace(NONCE_PLACEHOLDER, self.nonce), encoding="utf-8")
        os.chmod(target, 0o600)
        paths._chown(target)
        return target

    def _bpftrace_env(self) -> dict:
        """map 默认只放 4096 个键，连接一多就会悄悄停止计数。"""
        env = dict(os.environ)
        env.setdefault("BPFTRACE_MAX_MAP_KEYS", "262144")
        # 0.20 的上限就是 200（字符串放在 512 字节的 BPF 栈里），写大了直接拒绝启动。
        env.setdefault("BPFTRACE_MAX_STRLEN", "200")
        return env

    def _run(self) -> None:
        self._set_state("starting")
        paths.ensure_dir(self.log_file.parent)
        while not self._stop.is_set():
            try:
                log = open(self.log_file, "ab")
                paths._chown(self.log_file)
            except OSError:
                log = subprocess.DEVNULL
            env = self._bpftrace_env()
            try:
                proc = subprocess.Popen(
                    self.command,
                    stdout=subprocess.PIPE,
                    stderr=log,
                    text=True,
                    bufsize=1,
                    env=env,
                )
            except OSError as exc:
                if hasattr(log, "close"):
                    log.close()
                self._set_state("error", "启动 bpftrace 失败：%s" % exc)
                self._stop.wait(self.restart_delay)
                continue
            self._proc = proc
            self._set_state("running")
            try:
                if proc.stdout is not None:
                    for line in proc.stdout:
                        if self._stop.is_set():
                            break
                        self.feed_line(line)
            finally:
                if proc.stdout is not None:
                    proc.stdout.close()
                if hasattr(log, "close"):
                    log.close()
                code = proc.wait()
                self._proc = None
                if not self._stop.is_set() and code != 0:
                    # 新进程的 map 是空的，旧连接已经接不上，先结束免得一直挂着。
                    self.tracker.close_all()
            if self._stop.is_set():
                break
            self._set_state(
                "error",
                "bpftrace 退出（%s），%s 秒后重启" % (code, self.restart_delay),
            )
            self._stop.wait(self.restart_delay)
        self._set_state("stopped")

    def feed_line(self, line: str) -> bool:
        """处理一行；返回是否是一条有效事件。测试也直接调这里。"""
        prefix = self.nonce + "\t"
        if line.startswith(prefix):
            event = events.parse(line[len(prefix):])
        else:
            # map 快照由 bpftrace 自己打印，没有前缀；其它行一律不认。
            event = events.parse_map_line(line)
        if event is None:
            return False
        try:
            self.tracker.on_event(event)
        except Exception as exc:  # 单条坏事件不该让采集线程退出
            self._error = "处理事件失败：%r" % exc
            return False
        # 进程退出事件只用来收尾，不算“最后一条出网事件”。
        if event["type"] == "exit":
            return True
        now = self.clock()
        self._last_event = now
        if now - self._last_meta >= 2:
            self._last_meta = now
            try:
                self.db.set_meta("last_event_at", "%.3f" % now)
            except Exception:
                pass
        return True
