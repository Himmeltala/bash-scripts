"""mvnx 网页模式的转发进程：起页面、接接口、起进程。

只用 python3.7 起的标准库，不需要装东西。三件事：

- 页面与接口：读 bash 写好的状态文件，拼成 JSON 交给页面。
- 起进程：页面点启动时，用 subprocess 起一条 mvn，落在新会话里；
  会话号就是进程组号，停的时候整组 TERM，超时再 KILL。
- 干活的还是 bash：扫描、拼参数、写状态都在 mvnx 那边，
  每个请求拉起一次 ``mvnx --engine``，通过管道把请求递过去。

状态文件的格式见 lib/mvnx/server.sh，下面的列号必须与它一致。
"""

import argparse
import json
import os
import signal
import subprocess
import sys
import threading
import time
import webbrowser
from http import cookies as http_cookies
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

FS = "\x1f"

# 状态行的列，与 lib/mvnx/server.sh 里的 web_col 一致，0 起。
WS_KIND, SVC_KIND, POM_KIND, RUN_KIND = "ws", "svc", "pom", "run"
LIVE = ("starting", "ready")
MODES = ("auto", "compile", "no-compile", "rebuild")

COOKIE_NAME = "mvnx_web"
TOKEN_PARAM = "token"
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
        return self.f[idx] if idx < len(self.f) else ""

    @property
    def id(self):
        return self[1]

    @property
    def ws(self):
        return self[2]


WS_WIDTH, SVC_WIDTH, POM_WIDTH, RUN_WIDTH = 4, 9, 4, 16


def parse_rows(text):
    rows = []
    for line in text.splitlines():
        if not line:
            continue
        parts = line.split(FS)
        kind, width = parts[0], len(parts)
        if kind == WS_KIND and width == WS_WIDTH:
            rows.append(parts)
        elif kind == SVC_KIND and width == SVC_WIDTH:
            rows.append(parts)
        elif kind == POM_KIND and width == POM_WIDTH:
            rows.append(parts)
        elif kind == RUN_KIND and width == RUN_WIDTH:
            rows.append(parts)
    return rows


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
        poms = {}
        runs = {}
        workspaces = []
        by_id = {}
        for r in self.rows():
            if r[0] == WS_KIND:
                item = {"id": r[1], "root": r[2], "added": r[3], "poms": [], "services": []}
                by_id[r[1]] = item
                workspaces.append(item)
            elif r[0] == POM_KIND:
                poms.setdefault(r[2], []).append(r[3])
            elif r[0] == RUN_KIND:
                runs[r[1]] = Row(r)

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
                    "tag": r[1].split(".", 2)[-1],
                    "run": run_info(run) if run else None,
                }
            )

        for ws in workspaces:
            ws["poms"] = sorted(poms.get(ws["id"], []))
            ws["services"].sort(key=lambda s: (s["display"], s["id"]))
        return {"workspaces": workspaces, "now": int(time.time())}


def run_info(r):
    return {
        "id": r[1],
        "ws": r[2],
        "type": r[3],
        "tag": r[4],
        "path": r[5],
        "display": r[6],
        "module": r[7],
        "args": r[8],
        "cmd": r[9],
        "pid": r[10],
        "port": r[11],
        "status": r[12],
        "started": r[13],
        "code": r[14],
        "err": r[15],
    }


# ---------------------------------------------------------------- 进程


class Sessions:
    """起过的进程：bash 那边的运行记录只认会话号，这里额外握着 Popen，好等它、拿真实退出码。"""

    def __init__(self):
        self.lock = threading.Lock()
        self.procs = {}

    def spawn(self, workdir, argv, log_path):
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
    """一条长命的 bash：``mvnx --engine`` 一直守着请求流，页面来一个它做一个。

    一次请求一个进程的写法看着简单，代价大：扫描一个工程几秒，每次都要重新加载，
    而且启动进程的事得另找地方做。所以这里保持一个常驻，断了自己再拉起来。

    reserve 是唯一回两行的：先 ok，再一行数据（运行号、目录、参数、预排行、会话代次）。
    """

    # 回话带数据行的请求：除这几条之外都只有一行 ok。
    WITH_DATA = ("reserve",)

    WELCOME = "hello" + FS + "1\n"

    def __init__(self, mvnx, state, sessions, logs):
        self.mvnx = mvnx
        self.state = state
        self.sessions = sessions
        self.logs = Path(logs)
        self.lock = threading.Lock()
        self.proc = None
        # 逐字节读回话时拼行用；上一次没读完的残行在下个请求前丢掉。
        self._buffer = b""
        self._last_err = ""

    def _spawn(self):
        env = dict(os.environ)
        env["MVNX_WEB_ENGINE"] = "1"
        self.proc = subprocess.Popen(
            [self.mvnx, "--engine"],
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
                raise ApiError(502, "mvnx 执行端退出了，看 mvnx web 那个终端")
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
                raise ApiError(400, hint or "mvnx 处理失败，详见 mvnx web 的输出")
            if first != "ok":
                raise ApiError(502, "mvnx 回了看不懂的一行：%s" % first)
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
            raise ApiError(502, "mvnx 执行端断开：%s" % exc)

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
            if run[12] in LIVE:
                self.sessions.kill_group(run[10])
        # 正在跑的先停，再让 bash 删登记。
        self.call("remove", ws)

    def start(self, body):
        svc = str(body.get("svc", "")).strip()
        row = self.state.find(SVC_KIND, svc)
        if row is None:
            raise ApiError(404, "没有这个服务：%s" % svc)
        module = str(body.get("module", "") or "").strip()
        extra = str(body.get("extra", "") or "").strip()
        mode = str(body.get("mode", "auto") or "auto")
        if mode not in MODES:
            raise ApiError(400, "启动方式不认识：%s" % mode)

        # 同一模块上一个动作还在跑：启动与打包读同一个 target，重复跑只会互相盖。
        parent = svc.rsplit(".", 1)[0]
        for run in self.state.runs():
            if run[12] not in LIVE:
                continue
            if run[1] == svc or run[1].startswith(parent + "."):
                raise ApiError(409, "「%s」正在跑，先停掉" % run[6])

        # 页面上的参数改动要算数：先存进服务行，自动判编译与拼命令都按它来。
        args = (row[6] + " " + extra).strip() if extra else row[6]
        if module != row[5] or args != row[6]:
            self.call("update", svc, module, args)

        first = self.call("reserve", svc, module, extra, mode)
        parts = first.split(FS)
        if len(parts) < 6:
            raise ApiError(500, "mvnx 没有给出启动参数：%r" % first)
        # 回话是「运行号|目录|参数|预排行|代次」，数据行前面可能还有一个分隔符。
        if parts[0] == "":
            parts = parts[1:]
        runid, path, mvn_args, row_line, gen = parts[0], parts[1], parts[2], parts[3], parts[4]

        log_path = self.logs / runid.split(".", 1)[0] / (runid + ".log")
        argv = ["mvn"] + [w for w in mvn_args.split() if w]
        try:
            sid = self.sessions.spawn(path, argv, log_path)
        except OSError as exc:
            raise ApiError(500, "起 mvn 失败：%s" % exc)
        self.call("launched", sid, gen)
        return {"run": runid}

    def stop(self, runid):
        run = self.state.find(RUN_KIND, runid)
        if run is None or run[12] not in LIVE:
            raise ApiError(409, "这个服务没有在跑")
        self.sessions.kill_group(run[10])
        self.call("stop", runid)


# ---------------------------------------------------------------- 页面与接口


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
    server_version = "mvnx-web"
    protocol_version = "HTTP/1.1"

    static = None
    state = None
    sessions = None
    engine = None
    logs = None
    api_prefix = "/__mvnx/api"
    token = ""

    def log_message(self, fmt, *args):
        # 访问日志默认打到 stderr，被 mvnx 收进 runner.log，轮询一多就长，这里丢掉。
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
            self._authorize(url)
            body = self._read_json() if method == "POST" else {}
            result = self._dispatch(method, route, parse_qs(url.query), body)
        except ApiError as exc:
            self._json(exc.status, {"error": exc.message})
            return
        except Exception as exc:  # 页面看到一句人话，比连接被断开强
            log("接口出错 %s %s：%r" % (method, self.path, exc))
            self._json(500, {"error": "服务端出错：%s" % exc})
            return
        self._json(200, result)

    # ---- 路由

    def _dispatch(self, method, route, query, body):
        if route == "state":
            return self.state.snapshot()
        if route == "log":
            return self._log(query)
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
            engine.remove_workspace(str(body.get("ws", "")))
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
                str(body.get("module", "") or ""),
                str(body.get("args", "") or ""),
            )
            return {"ok": True}
        raise ApiError(404, "没有这个接口：%s" % route)

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

    def _authorize(self, url):
        if not self.token:
            return
        if self.headers.get("Authorization", "") == "Bearer " + self.token:
            return
        jar = http_cookies.SimpleCookie()
        try:
            jar.load(self.headers.get("Cookie", ""))
        except http_cookies.CookieError:
            jar = {}
        if COOKIE_NAME in jar and jar[COOKIE_NAME].value == self.token:
            return
        supplied = parse_qs(url.query).get(TOKEN_PARAM) or []
        # 链接里带了令牌就先收进 Cookie，之后浏览器发的请求都带着它。
        self._set_cookie = bool(supplied and supplied[0] == self.token)
        if self._set_cookie:
            return
        raise ApiError(401, "没有访问令牌，用 mvnx web 打印出来的带令牌的链接打开")

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
        if getattr(self, "_set_cookie", False):
            morsel = http_cookies.Morsel()
            morsel.set(COOKIE_NAME, self.token, self.token)
            morsel["path"] = "/"
            morsel["httponly"] = True
            morsel["samesite"] = "Strict"
            self.send_header("Set-Cookie", morsel.OutputString())
        self.end_headers()
        if not head:
            self.wfile.write(data)


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


def is_loopback(host):
    return host in ("127.0.0.1", "localhost", "::1")


def guess_host():
    """监听全地址时给浏览器一个能点开的地址：取本机出口 IP。"""
    import socket

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
    engine = Engine(os.path.abspath(args.mvnx), state, sessions, args.logs)

    # 监听非本机地址时必须有令牌，不然同网段谁都能起进程。
    token = "" if is_loopback(args.host) or args.public else os.urandom(16).hex()

    Handler.static = static
    Handler.state = state
    Handler.sessions = sessions
    Handler.engine = engine
    Handler.logs = str(Path(args.logs).resolve())
    Handler.api_prefix = args.api
    Handler.token = token

    try:
        httpd = ThreadingHTTPServer((args.host, args.port), Handler)
    except OSError as exc:
        log("端口 %s 用不了：%s" % (args.port, exc))
        return 1
    httpd.daemon_threads = True
    port = httpd.server_address[1]
    host = args.host if is_loopback(args.host) else guess_host()
    url = "http://%s:%d/" % (host, port)
    if token:
        url += "?%s=%s" % (TOKEN_PARAM, token)

    # mvnx 守着这一行等它就绪；端口填 0 时这里报的是真正用上的那个。
    # 带令牌时一并交出去：mvnx 把这个地址原样打印给用户，浏览器才能进得来。
    ready = "%s:%d" % (host, port) + ("/?%s=%s" % (TOKEN_PARAM, token) if token else "")
    print("MVNX_WEB_READY " + ready, flush=True)
    log("mvnx 网页：%s" % url)

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
    parser = argparse.ArgumentParser(prog="mvnx-web", description="mvnx 网页模式的转发进程")
    parser.add_argument("--static", required=True, help="打包好的页面目录")
    parser.add_argument("--state", required=True, help="状态文件")
    parser.add_argument("--logs", required=True, help="日志目录")
    parser.add_argument("--api", default="/__mvnx/api", help="接口前缀")
    parser.add_argument("--mvnx", required=True, help="mvnx 入口")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8770)
    parser.add_argument("--open", action="store_true", help="起来后打开浏览器")
    parser.add_argument("--public", action="store_true", help="监听非本机地址时不设令牌")
    return serve(parser.parse_args(argv))


if __name__ == "__main__":
    sys.exit(main())
