# @Author: Himmeltala
# @Date: 2026-11-26 09:29:54
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-26 09:29:54
# @FilePath: \idex\src\idex\engines\jvm\runs.py
# @Description: 运行记录：起进程、整组停止、识别端口与状态，运行历史落在 runs.json。

"""运行记录：起进程、整组停止、识别端口与状态，运行历史落在 runs.json。

进程本身仍由 mvnx / gradlex 的 ``exec`` 拉起，日志写进
``<缓存>/logs/<工作区>/<运行号>.log``，退出码由共享的 Sessions 写在日志旁边。
"""

import os
import re
import threading
import time
from pathlib import Path

from fileio import read_json, write_json
from runner import Sessions, group_alive, run_log_path, sh_shell_argv
from web import ApiError, log

# 与共享层一致的存活状态。
LIVE = ("starting", "ready")
# 运行历史只留最近这么多条，runs.json 不跟着构建次数无限长。
MAX_RUNS = 500
# 进程没了以后等退出码落盘的次数：退出码总会由 Sessions 写下来，等不到就按停止算。
DEAD_WAIT_TICKS = 8
# 监视循环的间隔。
MONITOR_INTERVAL = 0.25

# 端口识别沿用 mvnx server.sh 的两条正则：先认容器那一行，再退回本机 URL。
PORT_PAIR = re.compile(r"(Tomcat|Jetty|Undertow|Netty) started on port(?:\(s\)|s)?:? ?([0-9]+)")
PORT_URL = re.compile(r"https?://(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]):([0-9]{2,5})")


def detect_port(path):
    """从日志尾部找服务端口；找不到返回空串。只读末尾一块，日志再长也不整份重读。"""
    try:
        with open(str(path), "rb") as fh:
            fh.seek(0, os.SEEK_END)
            size = fh.tell()
            fh.seek(max(0, size - 65536))
            data = fh.read()
    except OSError:
        return ""
    text = data.decode("utf-8", "replace")
    lines = text.splitlines()[-60:]
    for line in lines:
        match = PORT_PAIR.search(line)
        if match:
            return match.group(2)
    for line in lines:
        # 仓库与 Nexus 的地址不是服务端口，跳过。
        if "/repository/" in line or "from the repositories" in line:
            continue
        match = PORT_URL.search(line)
        if match:
            return match.group(2)
    return ""


def error_text(path):
    """日志里第一条错误，页面直接展示；按行读到就停，构建日志几十 MB 也不整份载入。"""
    try:
        with open(str(path), "r", encoding="utf-8", errors="replace") as fh:
            for line in fh:
                if "[ERROR]" in line:
                    return line.split("[ERROR]", 1)[1].strip()[:300]
                if line.startswith("FAILURE:") or line.startswith("BUILD FAILED"):
                    return line.rstrip("\r\n")[:300]
    except OSError:
        return ""
    return ""


def find_artifact(run):
    """打包成功后 target 里最能代表这次的 jar；跳过 original 与源码包。"""
    base = Path(str(run.get("path") or "")) / str(run.get("module") or "") / "target"
    try:
        if not base.is_dir():
            return None
        jars = [
            path
            for path in base.glob("*.jar")
            if path.is_file()
            and not path.name.endswith((".original", "-sources.jar", "-javadoc.jar"))
        ]
        if not jars:
            return None
        latest = max(jars, key=lambda path: path.stat().st_mtime)
        stat = latest.stat()
    except OSError:
        return None
    return {"name": latest.name, "path": str(latest), "size": stat.st_size}


def read_code(path):
    """Sessions 写在日志旁边的退出码；还没写或不是数字时返回 None。"""
    try:
        text = Path(str(path) + ".code").read_text(encoding="utf-8").strip()
        return int(text)
    except (OSError, ValueError):
        return None


class RunRegistry:
    """运行记录与进程组；页面看到的状态都由这里推出来。"""

    def __init__(self, path, logs, grace=15.0):
        self.path = Path(path)
        self.logs = Path(logs)
        self.grace = grace
        self.lock = threading.RLock()
        self.sessions = Sessions(fallback=sh_shell_argv)
        self.runs = []
        self._thread = None
        self._stop = threading.Event()
        self._load()

    def _load(self):
        data = read_json(self.path, default=None)
        items = data.get("runs") if isinstance(data, dict) else None
        if not isinstance(items, list):
            return
        for item in items:
            if isinstance(item, dict) and item.get("id") and item.get("status"):
                self.runs.append(item)

    def _save(self):
        with self.lock:
            # 紧凑写：这份文件只给引擎自己读，缩进白占体积。
            write_json(self.path, {"runs": self.runs}, indent=None)

    # 超出上限时先丢最旧的已结束记录；在跑的永远留着。
    def _trim(self):
        excess = len(self.runs) - MAX_RUNS
        if excess <= 0:
            return
        done = [run for run in self.runs if run.get("status") not in LIVE]
        done.sort(key=lambda item: item.get("started_ns", 0))
        drop = set(id(run) for run in done[:excess])
        self.runs = [run for run in self.runs if id(run) not in drop]

    def start(self):
        if self._thread is not None:
            return
        self._thread = threading.Thread(target=self._monitor, daemon=True)
        self._thread.start()

    def close(self):
        self._stop.set()

    def _monitor(self):
        while not self._stop.is_set():
            try:
                self.advance()
            except Exception as exc:  # 单轮失败不掐断监视
                log("运行状态监视失败：%r" % exc)
            self._stop.wait(MONITOR_INTERVAL)

    def snapshot(self):
        with self.lock:
            return [dict(item) for item in self.runs]

    def latest_map(self):
        """每个服务只留最新一条运行，与 mvnx 网页「同一服务跑过多次」的口径一致。"""
        out = {}
        with self.lock:
            for run in self.runs:
                svc = run.get("svc", "")
                if not svc:
                    continue
                prev = out.get(svc)
                if prev is None or run.get("started_ns", 0) >= prev.get("started_ns", 0):
                    out[svc] = dict(run)
        return out

    def find(self, runid):
        with self.lock:
            for run in self.runs:
                if run.get("id") == runid:
                    return dict(run)
        return None

    def live_for(self, ws_id, tag):
        with self.lock:
            for run in self.runs:
                if run.get("status") in LIVE and run.get("ws") == ws_id and run.get("tag") == tag:
                    return dict(run)
        return None

    def live_ws(self, ws_id):
        with self.lock:
            return [dict(run) for run in self.runs if run.get("status") in LIVE and run.get("ws") == ws_id]

    def create(self, workdir, argv, meta, env=None):
        """起一条命令并记一条运行；日志目录按工作区 id 分。"""
        runid = "%s.%d" % (meta["svc"], time.time_ns())
        log_path = run_log_path(self.logs, runid)
        try:
            sid = self.sessions.spawn(str(workdir), argv, log_path, env=env)
        except OSError as exc:
            raise ApiError(500, "起 %s 失败：%s" % (argv[0], exc))
        run = dict(meta)
        run.update(
            {
                "id": runid,
                "pid": str(sid),
                "port": "",
                "status": "starting",
                "started": int(time.time()),
                "started_ns": time.time_ns(),
                "code": "",
                "err": "",
                "log": str(log_path),
                "miss": 0,
            }
        )
        with self.lock:
            self.runs.append(run)
            self._trim()
            self._save()
        return runid

    def stop(self, runid):
        """先标记停止中并立即回话，真正的收进程放后台，别让请求等满 grace。"""
        with self.lock:
            run = next((item for item in self.runs if item.get("id") == runid), None)
            if run is None or run.get("status") not in LIVE:
                raise ApiError(409, "这个服务没有在跑")
            pid = str(run.get("pid") or "")
            run["status"] = "stopping"
            run["miss"] = 0
            self._save()
        threading.Thread(
            target=self._reap,
            args=(runid, pid),
            name="idex-jvm-stop",
            daemon=True,
        ).start()
        return True

    def _reap(self, runid, pid):
        """后台把进程组收干净，再把记录落成已停止。"""
        self.sessions.kill_group(pid, grace=self.grace)
        with self.lock:
            for item in self.runs:
                if item.get("id") != runid:
                    continue
                item["pid"] = ""
                item["status"] = "stopped"
                item["miss"] = 0
            self._save()

    def stopping_for(self, ws_id, tag):
        with self.lock:
            for run in self.runs:
                if run.get("status") == "stopping" and run.get("ws") == ws_id and run.get("tag") == tag:
                    return dict(run)
        return None

    def wait_stopped(self, runid, timeout=None):
        """等某条记录彻底停下；重启要等旧进程退干净才能占回端口。"""
        deadline = time.monotonic() + (self.grace + 5 if timeout is None else timeout)
        while time.monotonic() < deadline:
            with self.lock:
                run = next((item for item in self.runs if item.get("id") == runid), None)
            if run is None or (run.get("status") not in LIVE and run.get("status") != "stopping"):
                return True
            time.sleep(0.05)
        return False

    def stop_workspace(self, ws_id):
        """移出工作区前把还在跑的进程停干净。"""
        for run in self.live_ws(ws_id):
            try:
                self.stop(run["id"])
            except ApiError:
                pass

    def remove_workspace(self, ws_id):
        with self.lock:
            self.runs = [item for item in self.runs if item.get("ws") != ws_id]
            self._save()

    def advance(self):
        """收拾在跑的记录：进程还活着就找端口，没了就按退出码落状态。

        探测端口、读日志这些文件操作都在锁外做，别让心跳卡住启停与状态查询。
        """
        with self.lock:
            watching = [dict(run) for run in self.runs if run.get("status") in LIVE]
        updates = dict((run["id"], self._advance_one(run)) for run in watching)

        changed = False
        with self.lock:
            for run in self.runs:
                if run.get("status") not in LIVE:
                    continue
                update = updates.get(run.get("id"))
                if not update:
                    continue
                if update.pop("_changed", False):
                    changed = True
                if update.pop("_drop_artifact", False):
                    run.pop("artifact", None)
                run.update(update)
            if changed:
                self._save()
        return changed

    def _advance_one(self, run):
        """单条记录的判定；返回要写回运行表的字段。"""
        log_path = run.get("log") or ""
        update: dict = {}
        try:
            pgid = int(str(run.get("pid") or ""))
        except ValueError:
            pgid = 0
        if pgid and group_alive(pgid):
            update = {"miss": 0}
            if run.get("status") == "starting":
                port = detect_port(log_path)
                if port:
                    update["port"] = port
                    update["status"] = "ready"
                    update["_changed"] = True
            return update

        code = read_code(log_path)
        if code is None:
            # Sessions 的回收线程可能还没把退出码写下来，等几轮再说。
            miss = int(run.get("miss") or 0) + 1
            if miss < DEAD_WAIT_TICKS:
                return {"miss": miss}
            return {"pid": "", "status": "stopped", "_changed": True}

        update = {
            "pid": "",
            "code": str(code),
            "status": "exited" if code == 0 else "failed",
            "err": "" if code == 0 else error_text(log_path),
            "miss": 0,
            "_changed": True,
        }
        if code == 0 and run.get("type") == "package":
            # 装成功才记产物；失败了不留下上一次的下载入口。
            artifact = find_artifact(run)
            if artifact:
                update["artifact"] = artifact
            else:
                update["_drop_artifact"] = True
        return update
