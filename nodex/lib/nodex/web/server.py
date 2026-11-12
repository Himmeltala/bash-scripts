"""nodex 网页模式的转发进程：起页面、接接口、起进程。

只用 python3.7 起的标准库，不需要装东西。三件事：

- 页面与接口：读 bash 写好的状态文件，拼成 JSON 交给页面。
- 起进程：页面点启动时，用 subprocess 起一条 pnpm/npm/yarn，落在新会话里；
  会话号就是进程组号，停的时候整组 TERM，超时再 KILL。
- 干活的还是 bash：扫描、拼参数、写状态都在 nodex 那边，
  ``nodex --engine`` 常驻，通过管道把请求递过去。

状态文件的格式见 lib/nodex/server.sh，下面的列号必须与它一致。
"""

import argparse
import codecs
import json
import os
import re
import signal
import socket
import subprocess
import sys
import threading
import time
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

FS = "\x1f"

# 状态行的列，与 lib/nodex/server.sh 里的 web_col 一致，0 起。
WS_KIND, SVC_KIND, PKG_KIND, RUN_KIND = "ws", "svc", "pkg", "run"
LIVE = ("starting", "ready")
# 运行号是「服务 id.纳秒」：去掉末尾那一段就是服务 id。
RUN_PREFIX_RE = re.compile(r"\.[0-9]+$")
# 行内列号（0 起）。svc 行与 run 行的公共段：id 1、工作区 2、类型 3。
CO_ID, CO_WS, CO_TYPE = 1, 2, 3
# svc 行：执行目录第 4 列、相对路径第 5 列、参数第 6 列、展示命令第 8 列、包管理器第 9 列。
SVC_DIR, SVC_REL, SVC_ARGS, SVC_CMD, SVC_PM = 4, 5, 6, 8, 9
# run 行（17 段，0 起）：包相对路径第 6 列、展示路径第 7 列、会话号 11、端口 12、状态 13。
RUN_REL = 6
RUN_DISPLAY = 7
RUN_PID, RUN_PORT, RUN_STATUS = 11, 12, 13
# run 行第 1 段是类型 run，第 2 段起依次是这 16 个字段，顺序与 lib/nodex/server.sh 的 web_run_line 一致。
RUN_FIELDS = ("id", "ws", "type", "tag", "path", "pl", "display", "module", "args",
              "cmd", "pid", "port", "status", "started", "code", "err")


# 一次引擎调用的上限：扫描大工程几秒，留足余量。
ENGINE_TIMEOUT = 120
# 日志一页行数。
LOG_PAGE = 400
# 状态文件坏了最多打这么多行日志，免得刷屏。
COERCIONS = 3


def log(msg):
    print(msg, file=sys.stderr, flush=True)


class Row:
    """状态行按列名取值。列数不对的行由 State 丢掉，这里只管取。
    """

    __slots__ = ("kind", "f")

    def __init__(self, parts):
        self.kind = parts[0]
        self.f = parts

    def __getitem__(self, idx):
        if isinstance(idx, slice):
            return self.f[idx]
        return self.f[idx] if idx < len(self.f) else ""

    @property
    def id(self):
        return self[1]

    @property
    def ws(self):
        return self[2]


WS_WIDTH, SVC_WIDTH, PKG_WIDTH, RUN_WIDTH = 4, 10, 4, 17
WIDTHS = {WS_KIND: WS_WIDTH, SVC_KIND: SVC_WIDTH, PKG_KIND: PKG_WIDTH, RUN_KIND: RUN_WIDTH}


def parse_rows(text):
    rows = []
    for line in text.splitlines():
        if not line:
            continue
        parts = line.split(FS)
        # 列数必须正好对上：多一段少一段都是写坏了，用它会整行错位，不如丢掉。
        if len(parts) == WIDTHS.get(parts[0]):
            rows.append(parts)
    return rows


# ---------------------------------------------------------------- 按工作区选 Node

# 自动扫描的四处：nvm、fnm、volta、n。别处的 Node 由页面手填路径。
NODE_ROOTS = (
    Path.home() / ".nvm" / "versions" / "node",
    Path.home() / ".local" / "share" / "fnm" / "node-versions",
    Path.home() / ".volta" / "tools" / "image" / "node",
    Path("/usr/local/n/versions/node"),
)


def is_node_home(path):
    """Node 的目录至少要有 bin/node；npm 有的版本放在上一层，这里不强求。"""
    home = Path(path)
    return (home / "bin" / "node").is_file()


def _version_key(name):
    """按版本号排：v20.11.1 比 v9.11.2 新。"""
    nums = re.findall(r"\d+", name)
    return tuple(int(x) for x in nums[:3])


def discover_nodes(roots=None):
    """扫已装的 Node。符号链接跳过：current 之类的别名指向真实目录，列出来只是重复。

    fnm 把可执行文件放在 <版本>/installation 下，nvm、volta、n 直接放在 <版本> 下。
    """
    out = []
    seen = set()
    for root in (roots if roots is not None else NODE_ROOTS):
        try:
            entries = sorted(Path(root).iterdir(), key=lambda p: p.name)
        except OSError:
            continue
        for entry in entries:
            if entry.name.startswith(".") or entry.is_symlink():
                continue
            try:
                if not entry.is_dir():
                    continue
            except OSError:
                continue
            home = entry / "installation" if (entry / "installation").is_dir() else entry
            try:
                real = home.resolve()
            except OSError:
                continue
            if real in seen or not is_node_home(real):
                continue
            seen.add(real)
            version = entry.name.lstrip("v")
            out.append({"path": str(real), "version": version, "label": version or real.name})

    out.sort(key=lambda item: _version_key(item["version"]), reverse=True)
    return out


def current_node_version():
    """页面上「跟随当前环境」时显示的那个版本。"""
    try:
        done = subprocess.run(
            ["node", "--version"], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=2
        )
        return done.stdout.decode("utf-8", "replace").strip().lstrip("v")
    except (OSError, subprocess.SubprocessError):
        return ""


def effective_node(node):
    """存着的目录还在才用它；不在了回退到当前环境。"""
    return node if node and is_node_home(node) else ""


def build_env(node, base=None):
    """node 非空时把它的 bin 放到 PATH 最前；空则原样继承。"""
    if not node:
        return None
    env = dict(os.environ if base is None else base)
    bindir = os.path.join(node, "bin")
    parts = [p for p in env.get("PATH", "").split(os.pathsep) if p and p != bindir]
    env["PATH"] = os.pathsep.join([bindir] + parts)
    return env


class NodeStore:
    """工作区到 Node 安装目录的映射，存在状态文件旁边，只有网页进程写它。"""

    def __init__(self, path):
        self.path = Path(path)
        self._lock = threading.Lock()

    def _load(self):
        out = {}
        try:
            text = self.path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            return out
        for line in text.splitlines():
            if not line:
                continue
            ws, sep, node = line.partition(FS)
            if sep and ws:
                out[ws] = node
        return out

    def _save(self, data):
        tmp = self.path.with_name(self.path.name + ".tmp")
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            text = "".join(ws + FS + node + "\n" for ws, node in data.items() if ws)
            tmp.write_text(text, encoding="utf-8")
            os.replace(tmp, self.path)
        except OSError as exc:
            log("写 Node 设置失败 %s：%s" % (self.path, exc))

    def get(self, ws):
        with self._lock:
            return self._load().get(ws, "")

    def set(self, ws, node):
        with self._lock:
            data = self._load()
            if node:
                data[ws] = node
            else:
                data.pop(ws, None)
            self._save(data)

    def remove(self, ws):
        with self._lock:
            data = self._load()
            data.pop(ws, None)
            self._save(data)


def attach_nodes(snapshot, store):
    """把每个工作区选中的 Node 与失效标记拼进状态回话。"""
    for ws in snapshot.get("workspaces", []):
        node = store.get(ws["id"])
        ws["node"] = node
        ws["node_missing"] = bool(node) and not is_node_home(node)
    return snapshot


class AliasStore:
    """工作区别名，存在状态文件旁边；状态文件本身仍由 bash 写，这里不碰它。"""

    def __init__(self, path):
        self.path = Path(path)
        self._lock = threading.Lock()

    def _load(self):
        out = {}
        try:
            text = self.path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            return out
        for line in text.splitlines():
            if not line:
                continue
            ws, sep, alias = line.partition(FS)
            if sep and ws and alias:
                out[ws] = alias
        return out

    def _save(self, data):
        tmp = self.path.with_name(self.path.name + ".tmp")
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            text = "".join(ws + FS + alias + "\n" for ws, alias in data.items() if ws and alias)
            tmp.write_text(text, encoding="utf-8")
            os.replace(tmp, self.path)
        except OSError as exc:
            log("写别名失败 %s：%s" % (self.path, exc))

    def all(self):
        with self._lock:
            return self._load()

    def set(self, ws, alias):
        alias = " ".join((alias or "").split()).replace(FS, " ")
        if len(alias) > 80:
            raise ApiError(400, "别名太长，最多 80 个字")
        with self._lock:
            data = self._load()
            if alias:
                data[ws] = alias
            else:
                data.pop(ws, None)
            self._save(data)


def attach_alias_rel(snapshot, store):
    """把别名与相对家目录的路径拼进工作区列表。"""
    aliases = store.all() if store is not None else {}
    home = os.path.expanduser("~")
    for ws in snapshot.get("workspaces", []):
        ws["alias"] = aliases.get(ws["id"], "")
        root = ws.get("root", "")
        try:
            ws["rel"] = os.path.relpath(root, home)
        except (TypeError, ValueError):
            ws["rel"] = root
    return snapshot


# ---------------------------------------------------------------- 状态文件


class State:
    """状态文件只读：写全在 bash 那边，写的时候整体替换，这里读到的总是完整的一份。

    页面轮询很密，先比 mtime，没变就不重新解析。
    """

    def __init__(self, path):
        self.path = Path(path)
        self._lock = threading.Lock()
        self._mtime = None
        self._rows = []

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
            self._rows = parse_rows(text)
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
            if r[0] != RUN_KIND:
                continue
            if ws is not None and r[2] != ws:
                continue
            out.append(Row(r))
        return out

    def snapshot(self):
        packages = {}
        runs = {}
        workspaces = []
        by_id = {}
        for r in self.rows():
            if r[0] == WS_KIND:
                item = {"id": r[1], "root": r[2], "added": r[3], "packages": [], "services": []}
                by_id[r[1]] = item
                workspaces.append(item)
            elif r[0] == PKG_KIND:
                packages.setdefault(r[2], []).append({"rel": r[1], "name": r[3]})
            elif r[0] == RUN_KIND:
                # 一个服务跑过多次会留下多条记录，留下最新的一条。
                runs[RUN_PREFIX_RE.sub("", r[1])] = Row(r)

        for r in self.rows():
            if r[0] != SVC_KIND:
                continue
            ws = by_id.get(r[2])
            if ws is None:
                continue
            run = runs.get(r[1])
            ws["services"].append(
                {
                    "id": r[1],
                    "type": r[3],
                    "path": r[4],
                    "module": r[5],
                    "args": r[6],
                    "display": r[7],
                    "cmd": r[8],
                    "pm": r[9],
                    "tag": r[1].split(".", 2)[-1],
                    "run": run_info(run) if run else None,
                }
            )

        for ws in workspaces:
            items = packages.get(ws["id"], [])
            items.sort(key=lambda item: (item["rel"] != ".", item["rel"]))
            ws["packages"] = items
            ws["services"].sort(key=lambda s: (s["display"], s["id"]))
        return {"workspaces": workspaces, "now": int(time.time())}


def run_info(r):
    # Row 的 self.f 是整行，第 1 段是类型；列表切片不走 __getitem__，用 .f 取。
    d = dict(zip(RUN_FIELDS, r.f[1:]))
    d.setdefault("pl", "")
    return d


# ---------------------------------------------------------------- 进程


class Sessions:
    """起过的进程：bash 那边的运行记录只认会话号，这里额外握着 Popen，好等它、拿真实退出码。"""

    def __init__(self):
        self.lock = threading.Lock()
        self.procs = {}

    def spawn(self, workdir, argv, log_path, env=None):
        """新会话起一条命令，返回会话号；日志收进 log_path，退出后把退出码写进 <日志>.code。"""
        log_path = Path(log_path)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        with open(os.devnull, "rb") as fh, open(log_path, "wb") as out:
            proc = subprocess.Popen(
                argv,
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


# ---------------------------------------------------------------- 引擎


class ApiError(Exception):
    def __init__(self, status, message):
        Exception.__init__(self, message)
        self.status = status
        self.message = message


class Engine:
    """一条长命的 bash：``nodex --engine`` 一直守着请求流，页面来一个它做一个。

    一次请求一个进程的写法看着简单，代价大：扫描一个工程几秒，每次都要重新加载，
    而且启动进程的事得另找地方做。所以这里保持一个常驻，断了自己再拉起来。

    reserve 是唯一回两行的：先 ok，再一行数据（运行号、目录、参数、预排行、会话代次）。
    """

    # 回话带数据行的请求：除这几条之外都只有一行 ok。
    WITH_DATA = ("reserve",)

    WELCOME = "hello" + FS + "1\n"

    def __init__(self, nodex, state, sessions, logs, nodes=None):
        self.nodex = nodex
        self.state = state
        self.sessions = sessions
        self.logs = Path(logs)
        self.nodes = nodes
        self.lock = threading.Lock()
        self.proc = None
        # 逐字节读回话时拼行用；上一次没读完的残行在下个请求前丢掉。
        self._buffer = b""
        self._last_err = ""

    def _spawn(self):
        env = dict(os.environ)
        env["NODEX_WEB_ENGINE"] = "1"
        self.proc = subprocess.Popen(
            [self.nodex, "--engine"],
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
                raise ApiError(502, "nodex 执行端退出了，看 nodex web 那个终端")
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
                raise ApiError(400, hint or "nodex 处理失败，详见 nodex web 的输出")
            if first != "ok":
                raise ApiError(502, "nodex 回了看不懂的一行：%s" % first)
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
            raise ApiError(502, "nodex 执行端断开：%s" % exc)

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

    # ---- 页面的动作

    def add_workspace(self, root):
        self.call("add", root)

    def remove_workspace(self, ws):
        for run in self.state.runs(ws):
            if run[RUN_STATUS] in LIVE:
                self.sessions.kill_group(run[RUN_PID])
        # 正在跑的先停，再让 bash 删登记。
        self.call("remove", ws)

    def start(self, body):
        svc = str(body.get("svc", "")).strip()
        row = self.state.find(SVC_KIND, svc)
        if row is None:
            raise ApiError(404, "没有这个服务：%s" % svc)
        extra = str(body.get("extra", "") or "").strip()

        # 同一个包的另一个动作还在跑：dev 与 build 读写同一份 dist，重复跑只会互相盖。
        # 不同包的开发服务可以同时开，端口各自不同。
        for run in self.state.runs():
            if run[RUN_STATUS] not in LIVE:
                continue
            if run[CO_WS] == row[CO_WS] and run[RUN_REL] == row[SVC_REL]:
                raise ApiError(409, "「%s」正在跑，先停掉" % run[RUN_DISPLAY])
            # 同一个工作区里的 install 也要串行：pnpm 的存储与锁文件只有一份。
            if row[CO_TYPE] == "install" and run[CO_TYPE] == "install" and run[CO_WS] == row[CO_WS]:
                raise ApiError(409, "「%s」正在安装，等它跑完" % run[RUN_DISPLAY])

        # 页面上的参数改动要算数：先存进服务行，启动与展示命令都按它来。
        args = (row[SVC_ARGS] + " " + extra).strip() if extra else row[SVC_ARGS]
        if extra:
            self.call("update", svc, args)

        first = self.call("reserve", svc, extra)
        parts = first.split(FS)
        # 回话是「运行号|目录|参数|预排行|代次」：预排行自己带着分隔符，段数不定。
        # 前四段取头部，代次取最后一段，中间那串就是预排行。
        if len(parts) < 5:
            raise ApiError(500, "nodex 没有给出启动参数：%r" % first)
        if parts[0] == "":
            parts = parts[1:]
        runid, path, run_args = parts[0], parts[1], parts[2]
        gen = parts[-1]

        log_path = self.logs / runid.split(".", 1)[0] / (runid + ".log")
        argv = [row[SVC_PM]] + [w for w in run_args.split() if w]
        raw_node = self.nodes.get(row[CO_WS]) if self.nodes else ""
        node = effective_node(raw_node)
        if raw_node and not node:
            log("工作区 %s 选的 Node 已不存在，回退到当前环境：%s" % (row[CO_WS], raw_node))
        env = build_env(node)
        try:
            sid = self.sessions.spawn(path, argv, log_path, env=env)
        except OSError as exc:
            raise ApiError(500, "起 %s 失败：%s" % (row[SVC_PM], exc))
        self.call("launched", sid, gen)
        return {"run": runid}

    def stop(self, runid):
        run = self.state.find(RUN_KIND, runid)
        if run is None or run[RUN_STATUS] not in LIVE:
            raise ApiError(409, "这个服务没有在跑")
        self.sessions.kill_group(run[RUN_PID])
        self.call("stop", runid)


# ---------------------------------------------------------------- 页面与接口


# ---------------------------------------------------------------- 目录浏览

# 一次最多回多少子目录：家目录之外也可能有几千项的目录，超过就截断并告诉页面。
MAX_DIRS = 1000


def _inside(path, home):
    return path == home or home in path.parents


def _is_dir_entry(entry, home):
    """这一项算不算能进的家目录子目录：符号链接要落到家目录里面才算。"""
    try:
        if entry.is_symlink():
            real = Path(entry.path).resolve()
            return _inside(real, home) and real.is_dir()
        return entry.is_dir(follow_symlinks=False)
    except OSError:
        return False


def list_dirs(raw):
    """列家目录内某一层的子目录；空路径就是家目录本身。"""
    home = Path.home().resolve()
    text = (raw or "").strip()
    target = Path(os.path.expanduser(text)) if text else home
    if not target.is_absolute():
        target = home / target
    try:
        target = target.resolve()
    except OSError as exc:
        raise ApiError(400, "解析目录失败：%s" % exc)
    if not _inside(target, home):
        raise ApiError(400, "只能浏览家目录内的目录：%s" % home)
    if not target.is_dir():
        raise ApiError(400, "不是目录：%s" % text)

    entries = []
    truncated = False
    try:
        with os.scandir(target) as it:
            for entry in it:
                if entry.name.startswith("."):
                    continue
                if not _is_dir_entry(entry, home):
                    continue
                entries.append({"name": entry.name, "path": str(Path(entry.path))})
                if len(entries) >= MAX_DIRS:
                    truncated = True
                    break
    except PermissionError:
        raise ApiError(403, "没有权限读取：%s" % target)
    except OSError as exc:
        raise ApiError(400, "读取目录失败：%s" % exc)
    entries.sort(key=lambda item: item["name"].casefold())

    return {
        "home": str(home),
        "path": str(target),
        "parent": None if target == home else str(target.parent),
        "entries": entries,
        "truncated": truncated,
    }


def _percent(used, total):
    if not total:
        return None
    return round(100.0 * used / total, 1)


class Metrics:
    """CPU、内存、磁盘占用，页面头部那三张小图用。

    只用 /proc 与 statvfs，不引第三方库。CPU 占用只有两次采样之间才算得出来：
    第一次请求时先取一次、等 200ms 再取一次，之后每次请求都用上一次留下的计数器，
    间隔就是页面的刷新周期。
    """

    SAMPLE_PAUSE = 0.2

    def __init__(self, home=None):
        self.home = Path(home) if home else Path.home()
        self.mount = self._mount_of(self.home)
        self._lock = threading.Lock()
        self._prev = None

    @staticmethod
    def _counters():
        with open("/proc/stat", "r") as fh:
            parts = fh.readline().split()[1:]
        nums = [int(x) for x in parts]
        # 空闲算 idle 加 iowait，其余（user、system、irq 等）都算忙。
        idle = nums[3] + (nums[4] if len(nums) > 4 else 0)
        return idle, sum(nums)

    @staticmethod
    def _mount_of(path):
        target = str(path.resolve())
        best = "/"
        try:
            with open("/proc/mounts", "r") as fh:
                for line in fh:
                    fields = line.split()
                    if len(fields) < 2:
                        continue
                    point = fields[1]
                    prefix = point.rstrip("/") + "/"
                    if target == point or target.startswith(prefix):
                        if len(point) > len(best):
                            best = point
        except OSError:
            pass
        return best

    def cpu(self):
        with self._lock:
            prev = self._prev
            cur = self._counters()
            if prev is None:
                time.sleep(self.SAMPLE_PAUSE)
                prev, cur = cur, self._counters()
            self._prev = cur
        idle, total = cur[0] - prev[0], cur[1] - prev[1]
        if total <= 0:
            return None
        return round(min(100.0, max(0.0, 100.0 * (total - idle) / total)), 1)

    def mem(self):
        info = {}
        with open("/proc/meminfo", "r") as fh:
            for line in fh:
                key, _, rest = line.partition(":")
                fields = rest.split()
                if key and fields:
                    info[key] = int(fields[0]) * 1024
        total = info.get("MemTotal", 0)
        avail = info.get("MemAvailable")
        if avail is None:  # 老内核没有 MemAvailable，退回三项相加
            avail = info.get("MemFree", 0) + info.get("Buffers", 0) + info.get("Cached", 0)
        used = max(0, total - avail)
        return {"used": used, "total": total, "percent": _percent(used, total)}

    def disk(self):
        st = os.statvfs(str(self.home))
        total = st.f_frsize * st.f_blocks
        free = st.f_frsize * st.f_bfree
        avail = st.f_frsize * st.f_bavail
        used = max(0, total - free)
        return {
            "used": used,
            "total": total,
            "avail": avail,
            "percent": _percent(used, total),
            "mount": self.mount,
        }

    def snapshot(self):
        out = {"time": int(time.time())}
        for key in ("cpu", "mem", "disk"):
            try:
                out[key] = getattr(self, key)()
            except (OSError, ValueError) as exc:
                log("取 %s 指标失败：%s" % (key, exc))
                out[key] = None
        return out


METRICS = Metrics()
# 指标栏的推送间隔；前端按这个节奏存点，60 个点正好覆盖 5 分钟。
METRICS_STREAM_INTERVAL = 5.0


CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".gif": "image/gif",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".map": "application/json; charset=utf-8",
}


class Handler(BaseHTTPRequestHandler):
    server_version = "nodex-web"
    protocol_version = "HTTP/1.1"

    static = None
    state = None
    sessions = None
    engine = None
    nodes = None
    aliases = None
    logs = None
    api_prefix = "/__nodex/api"

    def log_message(self, fmt, *args):
        # 访问日志默认打到 stderr，被 nodex 收进 runner.log，轮询一多就长，这里丢掉。
        pass

    def do_GET(self):
        self._route("GET")

    def do_HEAD(self):
        self._route("HEAD")

    def do_POST(self):
        self._route("POST")

    def _route(self, method):
        url = urlparse(self.path)
        if not url.path.startswith(self.api_prefix):
            if method == "POST":
                self._send(405, b"", "text/plain")
                return
            self._static(url.path, head=(method == "HEAD"))
            return
        route = url.path[len(self.api_prefix):].strip("/")
        try:
            if method == "POST":
                self._check_origin()
            body = self._read_json() if method == "POST" else {}
            result = self._dispatch(method, route, parse_qs(url.query), body)
        except ApiError as exc:
            self._json(exc.status, {"error": exc.message})
            return
        except Exception as exc:  # 页面看到一句人话，比连接被断开强
            log("接口出错 %s %s：%r" % (method, self.path, exc))
            self._json(500, {"error": "服务端出错：%s" % exc})
            return
        # 流式回话已经自己写完，别再套一层 JSON。
        if result is STREAMED:
            return
        self._json(200, result)

    # ---- 路由

    def _dispatch(self, method, route, query, body):
        if route == "log/stream":
            self._stream_log((query.get("run") or [""])[0])
            return STREAMED
        if route == "state":
            # 页面每两秒取一次状态，顺手让引擎收拾在跑的记录：端口、退出码、状态都靠这一趟更新。
            # 引擎自己出问题时照旧把状态给出去，页面不至于连列表都打不开。
            try:
                self.engine.call("tick")
            except ApiError as exc:
                log("tick 失败：%s" % exc.message)
            return attach_alias_rel(attach_nodes(self.state.snapshot(), self.nodes), self.aliases)
        if route == "log":
            return self._log(query)
        if route == "dirs":
            return list_dirs((query.get("path") or [""])[0])
        if route == "nodes":
            return {"nodes": discover_nodes(), "current": current_node_version()}
        if route == "metrics/stream":
            self._stream_metrics()
            return STREAMED
        if route == "metrics":
            return METRICS.snapshot()
        if method != "POST":
            raise ApiError(405, "这个接口只接受 POST")
        engine = self.engine
        if route == "workspaces":
            root = str(body.get("root", "")).strip()
            if not root:
                raise ApiError(400, "没给目录")
            engine.add_workspace(root)
            return {"ok": True}
        if route == "rescan":
            engine.call("scan", str(body.get("ws", "")))
            return {"ok": True}
        if route == "forget":
            ws = str(body.get("ws", ""))
            engine.remove_workspace(ws)
            self.nodes.remove(ws)
            if self.aliases is not None:
                self.aliases.set(ws, "")
            return {"ok": True}
        if route == "alias":
            ws = str(body.get("ws", "")).strip()
            if not ws or self.state.find(WS_KIND, ws) is None:
                raise ApiError(404, "没有这个工作区：%s" % ws)
            self.aliases.set(ws, str(body.get("alias", "")))
            return {"ok": True}
        if route == "node":
            ws = str(body.get("ws", "")).strip()
            node = str(body.get("node", "") or "").strip()
            if not ws or self.state.find(WS_KIND, ws) is None:
                raise ApiError(404, "没有这个工作区：%s" % ws)
            if node:
                node = os.path.abspath(os.path.expanduser(node))
                if not is_node_home(node):
                    raise ApiError(400, "这个目录不是 Node：缺 bin/node")
            self.nodes.set(ws, node)
            return {"ok": True}
        if route == "start":
            return engine.start(body)
        if route == "stop":
            engine.stop(str(body.get("run", "")))
            return {"ok": True}
        if route == "update":
            engine.call(
                "update",
                str(body.get("svc", "")),
                str(body.get("args", "") or ""),
            )
            return {"ok": True}
        raise ApiError(404, "没有这个接口：%s" % route)

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

        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "close")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()
        self.close_connection = True

        buf = LineBuffer()
        last_write = time.time()
        fh = None
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

    def _stream_metrics(self):
        """头部三个指标按固定间隔推，省得页面每 5 秒发一次请求。"""
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "close")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()
        self.close_connection = True
        try:
            while True:
                self.wfile.write(sse_data(METRICS.snapshot(), event="metrics").encode("utf-8"))
                self.wfile.flush()
                time.sleep(METRICS_STREAM_INTERVAL)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def _log(self, query):
        runid = (query.get("run") or [""])[0]
        run = self.state.find(RUN_KIND, runid)
        try:
            page = max(0, int((query.get("page") or ["0"])[0] or 0))
        except ValueError:
            page = 0
        path = Path(self.logs) / runid.split(".", 1)[0] / (runid + ".log")
        text, more = tail(path, page)
        info = run_info(run) if run else {}
        return {
            "run": runid,
            "status": info.get("status", ""),
            "code": info.get("code", ""),
            "text": text,
            "page": page,
            "more": more,
        }

    # ---- 安全与请求体

    def _check_origin(self):
        """跨站写请求挡在门外：只认同源的 Origin。没带 Origin 的（脚本、curl）放行。"""
        origin = self.headers.get("Origin")
        if not origin:
            return
        if urlparse(origin).netloc != self.headers.get("Host", ""):
            raise ApiError(403, "拒绝跨站写请求")

    def _read_json(self):
        length = self.headers.get("Content-Length")
        if length is None:
            return {}
        try:
            length = int(length)
        except ValueError:
            raise ApiError(400, "Content-Length 不对")
        raw = self.rfile.read(length) if length > 0 else b""
        if not raw:
            return {}
        try:
            data = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise ApiError(400, "请求体不是 JSON")
        if not isinstance(data, dict):
            raise ApiError(400, "请求体要是一个对象")
        return data

    # ---- 静态页面

    def _static(self, path, head=False):
        rel = path.lstrip("/") or "index.html"
        target = (self.static / rel).resolve()
        try:
            target.relative_to(self.static)
        except ValueError:
            self._send(404, b"", "text/plain", head=head)
            return
        if target.is_dir():
            target = target / "index.html"
        if not target.is_file():
            # 带点的当作文件，真没有就 404；其余交回首页，前端自己按路径找页面。
            if "." in Path(rel).name or not (self.static / "index.html").is_file():
                self._send(404, b"not found\n", "text/plain", head=head)
                return
            target = self.static / "index.html"
        ctype = CONTENT_TYPES.get(target.suffix.lower(), "application/octet-stream")
        # Vite 给带哈希的资源长名，一年缓存；首页不缓存，重新打包立刻生效。
        cache = "no-cache" if target.name == "index.html" else "public, max-age=600"
        data = b"" if head else target.read_bytes()
        self._send(200, data, ctype, head=head, cache=cache)

    def _json(self, status, payload):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self._send(status, data, "application/json; charset=utf-8", cache="no-store")

    def _send(self, status, data, ctype, head=False, cache=None):
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        if cache:
            self.send_header("Cache-Control", cache)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        if not head:
            self.wfile.write(data)


# _dispatch 用它表示「回话已经流式写完」，外层别再包 JSON。
STREAMED = object()


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


def sse_data(payload, event=None, event_id=None):
    """一条 SSE 事件。数据整体走 JSON，换行不会破坏 data 行的格式。"""
    head = ""
    if event_id is not None:
        head += "id: %s\n" % event_id
    if event:
        head += "event: %s\n" % event
    return head + "data: " + json.dumps(payload, ensure_ascii=False) + "\n\n"


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


# ---------------------------------------------------------------- 启动


def is_any(host):
    """0.0.0.0 与 :: 都是「所有网卡」，不能拿来当访问地址。"""
    return host in ("0.0.0.0", "::", "")


def guess_host():
    """监听全地址时给浏览器一个能点开的地址：取本机出口 IP，猜不出来就用回环。"""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            sock.connect(("10.255.255.255", 1))
            return sock.getsockname()[0]
        finally:
            sock.close()
    except OSError:
        return "127.0.0.1"


def serve(args):
    static = Path(args.static).resolve()
    if not (static / "index.html").is_file():
        log("缺 %s/index.html，前端还没打包" % static)
        return 3

    state = State(args.state)
    sessions = Sessions()
    nodes = NodeStore(Path(args.state).parent / "node.tsv")
    aliases = AliasStore(Path(args.state).parent / "alias.tsv")
    engine = Engine(os.path.abspath(args.nodex), state, sessions, args.logs, nodes)

    Handler.static = static
    Handler.state = state
    Handler.sessions = sessions
    Handler.engine = engine
    Handler.nodes = nodes
    Handler.aliases = aliases
    Handler.logs = str(Path(args.logs).resolve())
    Handler.api_prefix = args.api

    try:
        httpd = ThreadingHTTPServer((args.host, args.port), Handler)
    except OSError as exc:
        log("端口 %s 用不了：%s" % (args.port, exc))
        return 1
    httpd.daemon_threads = True
    port = httpd.server_address[1]
    host = guess_host() if is_any(args.host) else args.host
    url = "http://%s:%d/" % (host, port)

    # nodex 守着这一行等它就绪；端口填 0 时这里报的是真正用上的那个。
    print("NODEX_WEB_READY %s:%d" % (host, port), flush=True)
    log("nodex 网页：%s" % url)

    def shutdown(signum, frame):
        log("收到信号 %d，退出" % signum)
        threading.Thread(target=httpd.shutdown, daemon=True).start()

    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT, shutdown)

    if args.open:
        threading.Timer(0.5, webbrowser.open, args=(url,)).start()
    try:
        httpd.serve_forever()
    finally:
        httpd.server_close()
    return 0


def main(argv=None):
    parser = argparse.ArgumentParser(prog="nodex-web", description="nodex 网页模式的转发进程")
    parser.add_argument("--static", required=True, help="打包好的页面目录")
    parser.add_argument("--state", required=True, help="状态文件")
    parser.add_argument("--logs", required=True, help="日志目录")
    parser.add_argument("--api", default="/__nodex/api", help="接口前缀")
    parser.add_argument("--nodex", required=True, help="nodex 入口")
    parser.add_argument("--host", default="0.0.0.0", help="监听地址，默认所有网卡")
    parser.add_argument("--port", type=int, default=0, help="监听端口，默认 0 由系统挑")
    parser.add_argument("--open", action="store_true", help="起来后打开浏览器")
    return serve(parser.parse_args(argv))


if __name__ == "__main__":
    sys.exit(main())
