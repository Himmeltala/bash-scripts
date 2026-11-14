"""长命子进程与执行端管路：会话管理、逐行请求、状态文件缓存。

只收 nodex 与 mvnx 共有的部分；状态行各列的含义与业务动作仍留在各自的 server.py。
"""

import errno
import os
import re
import shutil
import signal
import subprocess
import threading
import time
from pathlib import Path

from stores import FS, Row
from web import ApiError, log

# run 行的列名与运行号前缀：nodex 与 mvnx 的状态格式一致。
RUN_FIELDS = ("id", "ws", "type", "tag", "path", "pl", "display", "module", "args",
              "cmd", "pid", "port", "status", "started", "code", "err")
RUN_KIND = "run"
RUN_PREFIX_RE = re.compile(r"\.[0-9]+$")
# 状态行的第 0 段是类型，列名对应的段号要加一。
RUN_PID = RUN_FIELDS.index("pid") + 1
RUN_STATUS = RUN_FIELDS.index("status") + 1
LIVE = ("starting", "ready")


def parse_fixed_rows(text, widths):
    """按首列查列数，列数正好对上的行才留下；空行跳过。"""
    rows = []
    for line in text.splitlines():
        if not line:
            continue
        parts = line.split(FS)
        # 列数必须正好对上：多一段少一段都是写坏了，用它会整行错位，不如丢掉。
        if len(parts) == widths.get(parts[0]):
            rows.append(parts)
    return rows


def run_info(row):
    # Row 的 self.f 是整行，第 1 段是类型；列表切片不走 __getitem__，用 .f 取。
    d = dict(zip(RUN_FIELDS, row.f[1:]))
    d.setdefault("pl", "")
    return d


def run_log_path(logs, runid):
    """运行号对应的日志：<logs>/<服务 id>/<运行号>.log。"""
    return Path(logs) / runid.split(".", 1)[0] / (runid + ".log")


def parse_reserve(text, label="执行端"):
    """解析 reserve 的回话：运行号|目录|参数|预排行|代次，预排行段数不定。"""
    parts = text.split(FS)
    if len(parts) < 5:
        raise ApiError(500, "%s 没有给出启动参数：%r" % (label, text))
    if parts[0] == "":
        parts = parts[1:]
    return parts[0], parts[1], parts[2], parts[-1], FS.join(parts[3:-1])


def latest_runs(rows):
    """同一服务跑过多次只留最新一条；行按写入顺序给，后面的覆盖前面的。"""
    out = {}
    for r in rows:
        if r[0] != RUN_KIND:
            continue
        out[RUN_PREFIX_RE.sub("", r[1])] = Row(r)
    return out


def sh_shell_argv(argv, env=None):
    """把没有 shebang 的可执行文件改成交给 /bin/sh 执行；找不到文件时返回 None。"""
    exe = argv[0]
    if os.sep not in exe:
        path = (env if env is not None else os.environ).get("PATH", os.defpath)
        exe = shutil.which(exe, path=path)
    if not exe or not os.path.exists(exe):
        return None
    return ["/bin/sh", exe] + list(argv[1:])


class Sessions:
    """起过的进程：工具的运行记录只认会话号，这里额外握着 Popen，好等它、拿真实退出码。"""

    def __init__(self, fallback=None):
        self.lock = threading.Lock()
        self.procs = {}
        # ENOEXEC 时的退路，按需由调用方给。
        self.fallback = fallback

    def spawn(self, workdir, argv, log_path, env=None):
        """新会话起一条命令，返回会话号；日志收进 log_path，退出后把退出码写进 <日志>.code。"""
        log_path = Path(log_path)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        with open(os.devnull, "rb") as fh, open(log_path, "wb") as out:
            try:
                proc = subprocess.Popen(
                    argv,
                    cwd=workdir,
                    stdin=fh,
                    stdout=out,
                    stderr=subprocess.STDOUT,
                    env=env,
                    start_new_session=True,
                )
            except OSError as exc:
                # 有的启动器不写 shebang，execvp 遇到 ENOEXEC 会退回 shell；Python 不会，这里补上。
                if exc.errno != errno.ENOEXEC:
                    raise
                fallback = self.fallback(argv, env) if self.fallback else None
                if fallback is None:
                    raise
                proc = subprocess.Popen(
                    fallback,
                    cwd=workdir,
                    stdin=fh,
                    stdout=out,
                    stderr=subprocess.STDOUT,
                    env=env,
                    start_new_session=True,
                )
        with self.lock:
            self.procs[proc.pid] = proc
        threading.Thread(target=self._reap, args=(proc, log_path), daemon=True).start()
        return proc.pid

    def _reap(self, proc, log_path):
        code = proc.wait()
        try:
            Path(str(log_path) + ".code").write_text("%d\n" % code, encoding="utf-8")
        except OSError as exc:
            log("写退出码失败 %s：%s" % (log_path, exc))
        with self.lock:
            self.procs.pop(proc.pid, None)

    def alive(self, sid):
        try:
            sid = int(sid)
        except (TypeError, ValueError):
            return False
        with self.lock:
            proc = self.procs.get(sid)
        return proc is not None and proc.poll() is None

    def kill_group(self, sid, grace=10.0):
        """整组 TERM，超时再 KILL。会话首进程就是组长，组号等于会话号。"""
        try:
            sid = int(sid)
        except (TypeError, ValueError):
            return
        try:
            os.killpg(sid, signal.SIGTERM)
        except (ProcessLookupError, PermissionError):
            return
        deadline = time.time() + grace
        while time.time() < deadline:
            if not group_alive(sid):
                return
            time.sleep(0.1)
        try:
            os.killpg(sid, signal.SIGKILL)
        except (ProcessLookupError, PermissionError):
            pass


def group_alive(sid):
    try:
        os.killpg(sid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


class EngineClient:
    """一条长命的执行端：按行发请求，断了再拉起来；扫描一次要几秒，不复用就每次重载。"""

    # 回话带数据行的请求：除这几条之外都只有一行 ok。
    WITH_DATA = ("reserve",)
    WELCOME = "hello" + FS + "1\n"
    # 出错提示里用的名字，子类改成 nodex / mvnx。
    label = "执行端"

    def __init__(self, command, state, sessions, logs):
        self.command = command
        self.state = state
        self.sessions = sessions
        self.logs = Path(logs)
        self.lock = threading.Lock()
        self.proc = None
        # 逐字节读回话时拼行用；上一次没读完的残行在下个请求前丢掉。
        self._buffer = b""
        self._last_err = ""

    def engine_env(self):
        """拉起执行端时补的环境变量，子类按自己的入口名给。"""
        return {}

    def _spawn(self):
        env = dict(os.environ)
        env.update(self.engine_env())
        self.proc = subprocess.Popen(
            [self.command, "--engine"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=env,
            bufsize=0,
        )
        threading.Thread(target=self._drain_err, args=(self.proc,), daemon=True).start()
        # 引擎起来先说一句话打招呼，说完等着，不等回话。
        self._write(self.WELCOME)

    def _drain_err(self, proc):
        for line in proc.stderr:
            text = line.decode("utf-8", "replace").rstrip()
            log("engine: " + text)
            if text:
                self._last_err = text

    def last_error(self):
        """最近一条引擎提示，失败时原样带给页面。"""
        return self._last_err

    def _write(self, text):
        self.proc.stdin.write(text.encode("utf-8"))
        self.proc.stdin.flush()

    def _readline(self):
        """读回一行。不能用 readline：管道不缓冲时它一次只给一个字节，行就断了。"""
        stdout = self.proc.stdout
        while b"\n" not in self._buffer:
            chunk = stdout.read(1)
            if not chunk:
                raise ApiError(502, "%s 执行端退出了，看 %s web 那个终端" % (self.label, self.label))
            self._buffer += chunk
        line, self._buffer = self._buffer.split(b"\n", 1)
        return line.decode("utf-8", "replace")

    def _request(self, op, *params):
        """发请求收一路回话：fail / ok / ok 再接一行数据。"""
        request = "reqfrom" + FS + FS.join([op] + [str(p) for p in params]) + "\n"
        # 上一次没打断的残行（正常不会出现）先扔掉，免得错位。
        self._buffer = b""
        try:
            self._write(request)
            first = self._readline()
            if first == "fail":
                # 引擎把原因打在 stderr 上，_drain_err 已经把它记成「engine: ...」那一行。
                hint = self.last_error()
                raise ApiError(400, hint or "%s 处理失败，详见 %s web 的输出" % (self.label, self.label))
            if first != "ok":
                raise ApiError(502, "%s 回了看不懂的一行：%s" % (self.label, first))
            if op in self.WITH_DATA:
                return self._readline()
            return ""
        except ApiError as exc:
            # 401/400 是引擎明确说不行，管道还同步，照常往下走。
            if exc.status != 400:
                self._drop()
            raise
        except (BrokenPipeError, OSError) as exc:
            self._drop()
            raise ApiError(502, "%s 执行端断开：%s" % (self.label, exc))

    def _drop(self):
        """回话对不上号了：这条引擎作废，下个请求重新拉一个。"""
        proc = self.proc
        self.proc = None
        self._buffer = b""
        if proc is not None and proc.poll() is None:
            try:
                proc.terminate()
            except OSError:
                pass

    def call(self, op, *params):
        """发一条请求，返回数据行（有的话）。"""
        with self.lock:
            if self.proc is not None and self._buffer:
                log("丢掉上一次没读完的一行：%r" % self._buffer)
                self._buffer = b""
            if self.proc is None or self.proc.poll() is not None:
                self._spawn()
            return self._request(op, *params)


class ToolEngine(EngineClient):
    """nodex 与 mvnx 共用的执行端动作：增删工作区、停止、解析 reserve 回话。"""

    def add_workspace(self, root):
        self.call("add", root)

    def remove_workspace(self, ws):
        for run in self.state.runs(ws):
            if run[RUN_STATUS] in LIVE:
                self.sessions.kill_group(run[RUN_PID])
        # 正在跑的先停，再让 bash 删登记。
        self.call("remove", ws)

    def stop(self, runid):
        run = self.state.find(RUN_KIND, runid)
        if run is None or run[RUN_STATUS] not in LIVE:
            raise ApiError(409, "这个服务没有在跑")
        self.sessions.kill_group(run[RUN_PID])
        self.call("stop", runid)

    def reserve(self, svc, *extra):
        """发 reserve 并拆回话，返回 (运行号, 目录, 参数, 代次, 预排行)。"""
        return parse_reserve(self.call("reserve", svc, *extra), self.label)


class StateRows:
    """状态文件只读：写全在工具那边、整体替换；页面轮询很密，先比 mtime，没变就不重新解析。"""

    RUN_KIND = "run"

    def __init__(self, path):
        self.path = Path(path)
        self._lock = threading.Lock()
        self._mtime = None
        self._rows = []

    def parse_rows(self, text):
        """状态文件怎么切成行由各工具自己定。"""
        raise NotImplementedError

    def rows(self):
        try:
            mtime = self.path.stat().st_mtime_ns
        except OSError:
            return []
        with self._lock:
            if mtime == self._mtime:
                return [list(r) for r in self._rows]
            try:
                text = self.path.read_text(encoding="utf-8", errors="replace")
            except OSError:
                return [list(r) for r in self._rows]
            self._rows = self.parse_rows(text)
            self._mtime = mtime
            return [list(r) for r in self._rows]

    def find(self, kind, ident):
        for r in self.rows():
            if r[0] == kind and r[1] == ident:
                return Row(r)
        return None

    def runs(self, ws=None):
        out = []
        for r in self.rows():
            if r[0] != self.RUN_KIND:
                continue
            if ws is not None and r[2] != ws:
                continue
            out.append(Row(r))
        return out
