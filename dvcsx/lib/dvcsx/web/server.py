#!/usr/bin/env python3
"""dvcsx 网页模式的转发进程：静态页面加 SVN / Git 查询与操作接口，只用标准库。

页面要的东西都由这里现跑 svn 或 git 命令取：工作副本变更、单个文件的差异、
提交日志、某次提交的完整说明，以及直接浏览工作副本的目录与文件内容。
查询只读；拉取、推送、切换分支、更新与提交会动工作副本或远端，只接受本机请求，
要放开到其他机器得用 --allow-write 启动。工作副本变化与操作输出走 SSE。
"""

import argparse
import hashlib
import ipaddress
import json
import os
import queue
import re
import shlex
import shutil
import signal
import socket
import subprocess
import sys
import threading
import time
import uuid
import webbrowser
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

# 共用骨架在仓库根的 lib/py-shared 下，源码与安装后的相对层级一致。
sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "lib" / "py-shared"))
from web import ApiError, CONTENT_TYPES, STREAMED, WebHandler, WebServer, guess_host, is_any, zip_dir

# 一次回给页面的文本上限：大文件的整份差异撑不住页面，截断后照样能看开头。
MAX_TEXT = 2 * 1024 * 1024
# 未纳入版本控制的文件没有差异可算，直接读内容预览，超过这个大小就不给。
MAX_FILE = 512 * 1024
SVN_TIMEOUT = 30
GIT_TIMEOUT = 30
# fetch 是取日志前顺手同步远端，等太久就把页面拖住了，超时先按本地记录出。
FETCH_TIMEOUT = 20
LOG_DEFAULT = 50
LOG_MAX = 200
LOG_SKIP_MAX = 1000
# 浏览目录时一层最多回这么多项，再多的目录列出来也翻不动。
BROWSE_MAX = 500
# 浏览目录的搜索：命中与扫过的文件都设上限，大工作副本不至于把页面拖住。
SEARCH_MAX = 300
SEARCH_FILES_MAX = 20000
SEARCH_LINE_MAX = 240
# 拉取、推送、更新与提交都要连远端，超时比查询宽松。
OPERATION_TIMEOUT = 300
COMMIT_MESSAGE_MAX = 8000
# 任务跑完之后还留一段时间，页面晚连上来也能看到完整输出。
JOB_KEEP = 600
JOB_LINES_MAX = 20000
# SSE 心跳与工作副本状态检查的间隔。
SSE_HEARTBEAT = 15
WATCH_INTERVAL = 3
# 登记表很小，变了就推，稍快一点页面也不觉得有延迟。
STATE_WATCH_INTERVAL = 0.5


def is_loopback(addr):
    """请求是不是本机发来的。写操作默认只认本机，免得同一网络里的人推代码。"""
    try:
        ip = ipaddress.ip_address(addr.split("%", 1)[0])
    except ValueError:
        return False
    # 监听 IPv6 的 :: 时，本机连接可能显示成映射地址 ::ffff:127.0.0.1。
    if ip.version == 6 and ip.ipv4_mapped:
        return ip.ipv4_mapped.is_loopback
    return ip.is_loopback


# 同一个工作副本同时只跑一个写操作，避免两次提交或一次更新与一次提交撞在一起。
_WS_LOCKS = {}
_WS_LOCKS_GUARD = threading.Lock()


def workspace_lock(wid):
    with _WS_LOCKS_GUARD:
        return _WS_LOCKS.setdefault(wid, threading.Lock())


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
        while True:
            with self.lock:
                if not self.subs.get(wid):
                    self.subs.pop(wid, None)
                    self.watchers.pop(wid, None)
                    return
            try:
                signature, count = changes_signature(ws)
            except Exception:
                signature, count = None, 0
            # 第一次也推一次：连接建立前后刚发生的改动不会漏掉，页面重载一次无妨。
            if signature is not None and signature != last:
                self.broadcast(wid, "changes", {"ws": wid, "count": count})
            if signature is not None:
                last = signature
            time.sleep(WATCH_INTERVAL)


class StateStream:
    """登记表一变就推一份给所有页面；页面不用再定时来取。"""

    def __init__(self, path, build):
        self.path = Path(path)
        self.build = build
        self.lock = threading.Lock()
        self.subs = set()
        self.payload = None

    def start(self):
        threading.Thread(target=self._run, daemon=True).start()

    def subscribe(self):
        box = queue.Queue(maxsize=1)
        with self.lock:
            self.subs.add(box)
            if self.payload is not None:
                box.put_nowait(self.payload)
        return box

    def unsubscribe(self, box):
        with self.lock:
            self.subs.discard(box)

    def _publish(self, payload):
        with self.lock:
            self.payload = payload
            subs = list(self.subs)
        for box in subs:
            if box.full():
                try:
                    box.get_nowait()
                except queue.Empty:
                    pass
            try:
                box.put_nowait(payload)
            except queue.Full:
                pass

    def _run(self):
        seen = None
        while True:
            try:
                mtime = self.path.stat().st_mtime_ns
            except OSError:
                mtime = None
            if mtime != seen:
                seen = mtime
                try:
                    self._publish(self.build())
                except Exception as exc:
                    log("取工作区列表失败：%r" % exc)
            time.sleep(STATE_WATCH_INTERVAL)


JOBS = Jobs()
HUB = EventHub()


def log(msg):
    print(time.strftime("%H:%M:%S"), msg, file=sys.stderr, flush=True)


# 工作副本登记

class Workspaces:
    """登记过的工作副本，存在 state.json 里；读写都加锁，多个请求并发加同一目录也只落一条。"""

    def __init__(self, path):
        self.path = Path(path)
        self.lock = threading.Lock()

    def load(self):
        try:
            data = json.loads(self.path.read_text("utf-8"))
        except (OSError, ValueError):
            return []
        items = data.get("workspaces") if isinstance(data, dict) else None
        if not isinstance(items, list):
            return []
        items = [w for w in items if isinstance(w, dict) and w.get("id") and w.get("root")]
        # 早先只收 SVN，记录里没有 vcs 字段，按 SVN 认；别名也是后加的。
        for item in items:
            item.setdefault("vcs", "svn")
            item.setdefault("alias", "")
        return items

    def save(self, items):
        tmp = self.path.with_suffix(".tmp")
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp.write_text(json.dumps({"workspaces": items}, ensure_ascii=False, indent=2), "utf-8")
        tmp.replace(self.path)

    def find(self, wid):
        for item in self.load():
            if item["id"] == wid:
                return item
        return None

    def add(self, root):
        root = os.path.abspath(os.path.expanduser(root))
        if not os.path.isdir(root):
            raise ApiError(400, "目录不存在：%s" % root)
        # 加之前先确认真是工作副本（SVN 或 Git），省得页面里攒一堆查不了东西的目录。
        vcs, info = detect_vcs(root)
        with self.lock:
            items = self.load()
            wid = hashlib.md5(root.encode("utf-8")).hexdigest()[:8]
            for item in items:
                if item["root"] == root:
                    # 地址换了（切分支、仓库迁移）、版本控制类型变了时跟着更新。
                    changed = item.get("vcs") != vcs or (info["url"] and item.get("url") != info["url"])
                    if changed:
                        item["vcs"] = vcs
                        if info["url"]:
                            item["url"] = info["url"]
                        self.save(items)
                    return item
            item = {
                "id": wid,
                "root": root,
                "vcs": vcs,
                "url": info["url"],
                "alias": "",
                "added": int(time.time()),
            }
            items.append(item)
            self.save(items)
            return item

    def remove(self, wid):
        with self.lock:
            items = self.load()
            left = [item for item in items if item["id"] != wid]
            if len(left) == len(items):
                raise ApiError(404, "没有这个工作区：%s" % wid)
            self.save(left)

    def set_alias(self, wid, alias):
        alias = " ".join((alias or "").split())
        if len(alias) > 80:
            raise ApiError(400, "别名太长，最多 80 个字")
        with self.lock:
            items = self.load()
            for item in items:
                if item["id"] == wid:
                    item["alias"] = alias
                    self.save(items)
                    return
            raise ApiError(404, "没有这个工作区：%s" % wid)

    def workspaces(self):
        # 早先登记的地址可能是百分号编码的，列出来之前统一还原成原文。
        home = os.path.expanduser("~")
        out = []
        for w in self.load():
            try:
                rel = os.path.relpath(w["root"], home)
            except (TypeError, ValueError):
                rel = w["root"]
            out.append(
                {
                    "id": w["id"],
                    "root": w["root"],
                    "vcs": w.get("vcs", "svn"),
                    "url": unquote(w.get("url", "")),
                    "alias": w.get("alias", ""),
                    "rel": rel,
                }
            )
        return out


# svn 查询

def svn(args, cwd=None, timeout=SVN_TIMEOUT):
    """跑一条 svn 命令，返回标准输出与错误文本。找不到 svn 与超时都按接口错误报出去。"""
    try:
        cp = subprocess.run(
            ["svn", "--non-interactive", *args],
            cwd=cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        raise ApiError(504, "svn 命令超过 %d 秒没跑完：%s" % (timeout, " ".join(args)))
    except OSError as exc:
        raise ApiError(500, "跑不起 svn，确认 svn 在 PATH 中、目录还在：%s" % exc)
    return cp.returncode, cp.stdout, cp.stderr.decode("utf-8", "replace").strip()


def xml_of(out):
    try:
        return ET.fromstring(out)
    except ET.ParseError as exc:
        raise ApiError(500, "svn 返回的 XML 读不懂：%s" % exc)


def node_text(parent, name):
    node = parent.find(name) if parent is not None else None
    return (node.text or "").strip() if node is not None and node.text else ""


def svn_info(root):
    rc, out, err = svn(["info", "--xml"], cwd=root)
    if rc != 0:
        raise ApiError(400, "这个目录不是 SVN 工作副本：%s" % (err or root))
    entry = xml_of(out).find("entry")
    if entry is None:
        raise ApiError(500, "svn info 没有给出条目：%s" % root)
    wc = entry.find("wc-info")
    # svn 给的是百分号编码的地址，中文项目名在页面上要看原文。
    return {
        "root": node_text(wc, "wcroot-abspath") or os.path.abspath(root),
        "revision": entry.get("revision", ""),
        "url": unquote(node_text(entry, "url")),
        "repo_root": unquote(node_text(entry.find("repository"), "root")),
        "last_changed_rev": node_text(entry.find("commit"), "revision"),
        "last_changed_author": node_text(entry.find("commit"), "author"),
    }


# 状态字母与中文名的对应只在页面上用，这里原样给 svn 的 item 值。
STATUS_ORDER = {
    "conflicted": 0,
    "replaced": 1,
    "renamed": 1,
    "modified": 2,
    "added": 3,
    "deleted": 4,
    "missing": 5,
    "obstructed": 6,
    "incomplete": 7,
    "unversioned": 8,
    "external": 9,
    "normal": 10,
}


def parse_status(out):
    files = []
    for entry in xml_of(out).iter("entry"):
        wc = entry.find("wc-status")
        if wc is None:
            continue
        item = wc.get("item", "normal")
        props = wc.get("props", "none")
        # 只有属性变了的照 svn 的说法也是 normal，单独标出来，否则页面上看不见。
        if item == "normal" and props != "modified":
            continue
        files.append(
            {
                "path": entry.get("path", ""),
                "item": item,
                "props": props,
                "revision": wc.get("revision", ""),
            }
        )
    files.sort(key=lambda f: (STATUS_ORDER.get(f["item"], 99), f["path"]))
    return files


# svn status 只报未纳入版本控制的目录本身，页面要能点到里面的文件，这里展开一层层。
# 依赖与产物目录不展开：它们动辄上千个文件，列出来也没人一个个看。
UNVERSIONED_SKIP = {".svn", ".git", ".hg", "node_modules", "__pycache__", "dist", "build"}
UNVERSIONED_MAX = 200


def unversioned_files(root, rel):
    """列出目录下的文件（工作副本内相对路径），到上限就停，返回 (路径表, 是否还有更多)。"""
    out = []
    base = os.path.join(root, rel)
    for dirpath, dirnames, filenames in os.walk(base):
        dirnames[:] = sorted(d for d in dirnames if d not in UNVERSIONED_SKIP)
        for name in sorted(filenames):
            out.append(os.path.relpath(os.path.join(dirpath, name), root))
            if len(out) >= UNVERSIONED_MAX:
                return out, True
    return out, False


def expand_unversioned(root, files):
    out = []
    truncated = False
    for item in files:
        target = os.path.join(root, item["path"])
        if item["item"] == "unversioned" and os.path.isdir(target):
            paths, more = unversioned_files(root, item["path"])
            truncated = truncated or more
            # 空目录没有文件可点，保留目录这一行，点开有提示。
            if not paths:
                out.append(item)
                continue
            out.extend({**item, "path": rel} for rel in paths)
        else:
            out.append(item)
    out.sort(key=lambda f: (STATUS_ORDER.get(f["item"], 99), f["path"]))
    return out, truncated


def parse_log(out):
    entries = []
    for entry in xml_of(out).iter("logentry"):
        paths = []
        for item in entry.iter("path"):
            paths.append(
                {
                    "action": item.get("action", ""),
                    "kind": item.get("kind", ""),
                    "path": (item.text or "").strip(),
                    "copyfrom": item.get("copyfrom-path", ""),
                }
            )
        entries.append(
            {
                "revision": entry.get("revision", ""),
                "author": node_text(entry, "author"),
                "date": node_text(entry, "date"),
                "message": node_text(entry, "msg"),
                "paths": paths,
            }
        )
    return entries


def svn_working_revisions(root):
    """工作副本里每个条目各自的版本。

    根目录的版本只记着上次更新的位置，自己刚提交的文件版本会更高，
    所以判断“这一版在不在本地”要按文件各自的版本看。
    """
    rc, out, err = svn(["info", "--xml", "-R"], cwd=root)
    if rc != 0:
        raise ApiError(500, err or "svn info 失败")
    revs = {}
    for entry in xml_of(out).iter("entry"):
        try:
            revs[entry.get("path", "")] = int(entry.get("revision", ""))
        except ValueError:
            continue
    return revs


def svn_entry_local(entry, prefix, revs, top, base_rev):
    """这一版的改动是否已经在工作副本里。

    工作副本根已经更新到这一版或更新时，整棵树都带上了这一版的改动，
    直接算本地已有。否则再按文件各自的版本看：这一版新加的文件后来又被
    删掉，就不在 revs 里，不能因此把这一版判成还没更新。
    """
    try:
        rev = int(entry["revision"])
    except (TypeError, ValueError):
        return False
    if rev <= base_rev:
        return True
    checked = 0
    for item in entry["paths"]:
        # 目录的版本不随提交往前走，拿它判断会把刚提交的改动误判成远程。
        if item.get("kind") == "dir":
            continue
        path = item.get("path") or ""
        if prefix:
            if not path.startswith(prefix + "/"):
                continue
            rel = path[len(prefix) + 1:]
        else:
            rel = path.lstrip("/")
        checked += 1
        if rel in revs:
            if revs[rel] < rev:
                return False
        elif item.get("action") != "D":
            # 这一版新加或改名的文件本地还没有，说明还没更新到这一版。
            return False
    if checked:
        return True
    # 这一版只动了目录：按工作副本里最新的版本判断。
    return top >= rev


def svn_log(root, limit):
    """读日志，并标出哪些提交已经随工作副本更新到了本地。"""
    entries, _ = svn_log_meta(root, limit)
    return entries


def svn_log_meta(root, limit, skip=0):
    """日志连同工作副本的版本位置：文件里最高的版本号。"""
    # 工作副本根目录本身的 BASE 往往是 r0，直接 svn log 会一条都没有；从 HEAD 往回想。
    # svn log 没有跳过多少条的参数，多取 skip 条再切掉前面已有的。
    fetch = limit + skip
    rc, out, err = svn(["log", "--xml", "-v", "-l", str(fetch), "-r", "HEAD:1"], cwd=root)
    if rc != 0:
        raise ApiError(500, err or "svn log 失败")
    entries = parse_log(out)
    revs = svn_working_revisions(root)
    top = max(revs.values(), default=0)
    info = svn_info(root)
    try:
        base_rev = int(info["revision"])
    except (TypeError, ValueError):
        base_rev = 0
    # svn log 给的路径相对仓库根，工作副本在仓库里的位置要从这两个地址里减出来。
    url_path = urlparse(info["url"]).path.rstrip("/")
    repo_path = urlparse(info["repo_root"]).path.rstrip("/")
    prefix = url_path[len(repo_path):].rstrip("/") if repo_path and url_path.startswith(repo_path) else url_path
    for entry in entries:
        entry["local"] = svn_entry_local(entry, prefix, revs, top, base_rev)
    return entries[skip:], {"wc_revision": top}


def svn_op(root, args, label):
    """跑一条会动工作副本或远端的 svn 命令，输出原样带回页面。"""
    rc, out, err = svn(args, cwd=root, timeout=OPERATION_TIMEOUT)
    text = "\n".join(
        part.strip()
        for part in (out.decode("utf-8", "replace"), err)
        if part.strip()
    )
    return {
        "ok": rc == 0,
        "command": "svn --non-interactive " + " ".join(args),
        "output": text,
        "error": "" if rc == 0 else (err.splitlines()[-1] if err else "svn %s 失败，退出码 %d" % (label, rc)),
    }


def svn_update_args():
    return ["update", "--accept", "postpone"]


def svn_update(root):
    """更新工作副本；冲突照默认的 postpone 留着，不替用户取舍。"""
    return svn_op(root, svn_update_args(), "update")


def svn_commit_args(root, message, paths):
    """校验提交参数并给出 svn 子命令；冲突或未纳管的路径先挡住。"""
    message = (message or "").strip()
    if not message:
        raise ApiError(400, "提交说明不能为空")
    if len(message) > COMMIT_MESSAGE_MAX:
        raise ApiError(400, "提交说明太长，最多 %d 字" % COMMIT_MESSAGE_MAX)
    if not isinstance(paths, list) or not paths:
        raise ApiError(400, "没有选中要提交的路径")
    clean = []
    for rel in paths:
        rel = safe_rel(str(rel))
        if not inside(root, os.path.join(root, rel)):
            raise ApiError(400, "路径要在工作副本里：%s" % rel)
        clean.append(rel)
    # 冲突与未纳管的路径先挡住，让页面给出明确原因，而不是一串 svn 报错。
    rc, out, err = svn(["status", "--xml"], cwd=root)
    if rc != 0:
        raise ApiError(500, err or "svn status 失败")
    state = {item["path"]: item["item"] for item in parse_status(out)}
    blocked = []
    for rel in clean:
        item = state.get(rel)
        if item == "conflicted":
            blocked.append("%s（有冲突）" % rel)
        elif item == "unversioned":
            blocked.append("%s（未纳入版本控制）" % rel)
        elif item == "missing":
            blocked.append("%s（本地缺失，先 svn delete）" % rel)
    if blocked:
        raise ApiError(400, "这些路径不能提交：%s" % "、".join(blocked))
    return ["commit", "-m", message, "--", *clean]


def svn_commit(root, message, paths):
    return svn_op(root, svn_commit_args(root, message, paths), "commit")


def svn_sync_info(root):
    info = svn_info(root)
    rc, out, err = svn(["status", "--xml"], cwd=root)
    if rc != 0:
        raise ApiError(500, err or "svn status 失败")
    files = [item for item in parse_status(out) if item["item"] != "unversioned"]
    return {
        **info,
        "vcs": "svn",
        "files": files,
        "conflicts": [item["path"] for item in files if item["item"] == "conflicted"],
    }


def svn_commit_detail(root, rev):
    """一个版本的完整信息；svn log 本来就给整段提交说明。"""
    if not (rev or "").isdigit():
        raise ApiError(400, "版本号不对：%s" % rev)
    rc, out, err = svn(["log", "--xml", "-v", "-r", rev], cwd=root)
    if rc != 0:
        raise ApiError(400, err or "读不了这个版本")
    entries = parse_log(out)
    if not entries:
        raise ApiError(404, "没有这个版本：%s" % rev)
    entry = entries[0]
    return {
        "revision": entry["revision"],
        "short": "r" + entry["revision"],
        "author": entry["author"],
        "email": "",
        "date": entry["date"],
        "parents": [],
        "refs": [],
        "message": entry["message"],
        "paths": entry["paths"],
    }


def safe_rel(rel):
    """接口收到的工作副本内相对路径：不许绝对路径，不许用 .. 跳出工作副本。"""
    rel = (rel or "").strip()
    if not rel:
        raise ApiError(400, "没给文件路径")
    if rel.startswith("/") or any(part == ".." for part in Path(rel).parts):
        raise ApiError(400, "路径要在工作副本里：%s" % rel)
    return rel


def inside(root, target):
    try:
        Path(target).resolve().relative_to(Path(root).resolve())
        return True
    except (ValueError, OSError):
        return False


def clip(text):
    if len(text) <= MAX_TEXT:
        return text, False
    return text[:MAX_TEXT] + "\n…（差异太长，后面的没有显示）\n", True


# 浏览目录时跳过的东西：版本库内部目录、依赖与产物目录、IDE 配置。
BROWSE_SKIP = UNVERSIONED_SKIP | {"target", ".idea"}


def browse_rel(rel):
    """浏览接口的路径：空串表示登记的目录本身，其余按工作副本内相对路径校验。"""
    rel = (rel or "").strip()
    if not rel:
        return ""
    return safe_rel(rel)


def browse_list(root, rel):
    """列一层目录，目录在前、文件在后；只认登记目录底下的东西。"""
    rel = browse_rel(rel).rstrip("/")
    target = os.path.join(root, rel) if rel else root
    if not inside(root, target):
        raise ApiError(400, "路径要在工作副本里：%s" % rel)
    if not os.path.isdir(target):
        raise ApiError(404, "目录不存在：%s" % (rel or "根目录"))
    entries = []
    try:
        with os.scandir(target) as it:
            for entry in it:
                if entry.name in BROWSE_SKIP:
                    continue
                try:
                    is_dir = entry.is_dir(follow_symlinks=True)
                except OSError:
                    is_dir = False
                item = {
                    "name": entry.name,
                    "path": (rel + "/" + entry.name) if rel else entry.name,
                    "type": "dir" if is_dir else "file",
                }
                if not is_dir:
                    try:
                        item["size"] = entry.stat(follow_symlinks=True).st_size
                    except OSError:
                        item["size"] = 0
                entries.append(item)
    except OSError as exc:
        raise ApiError(403, "读不了目录：%s" % exc)
    entries.sort(key=lambda e: (e["type"] != "dir", e["name"].lower()))
    truncated = len(entries) > BROWSE_MAX
    return {"path": rel, "entries": entries[:BROWSE_MAX], "truncated": truncated}


def search_lines(path, needle):
    """逐行找内容，跳过二进制、超大与不是 UTF-8 的文件，产出 (行号, 行文本)。"""
    try:
        if os.path.getsize(path) > MAX_FILE:
            return
        data = Path(path).read_bytes()
    except OSError:
        return
    if b"\x00" in data:
        return
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        return
    for number, line in enumerate(text.splitlines(), 1):
        if needle in line.lower():
            yield number, line.strip()[:SEARCH_LINE_MAX]


def browse_search(root, rel, query, mode):
    """在工作副本里按文件名或文件内容找。

    文件名按工作副本内的相对路径做不区分大小写的包含匹配；内容逐行找，只读预览
    得了的文本文件。命中或扫过的文件到上限就停，truncated 说明还有没扫完的。
    """
    base = browse_rel(rel).rstrip("/")
    target = os.path.join(root, base) if base else root
    if not inside(root, target):
        raise ApiError(400, "路径要在工作副本里：%s" % rel)
    if not os.path.isdir(target):
        raise ApiError(404, "目录不存在：%s" % (rel or "根目录"))
    needle = (query or "").strip()
    if mode not in ("name", "content"):
        mode = "name"
    if not needle:
        return {"query": "", "mode": mode, "matches": [], "truncated": False}
    low = needle.lower()
    matches = []
    scanned = 0
    truncated = False
    for dirpath, dirnames, filenames in os.walk(target):
        dirnames[:] = sorted(d for d in dirnames if d not in BROWSE_SKIP)
        for name in sorted(filenames):
            path = os.path.join(dirpath, name)
            # 链接指到工作副本外的不看，免得搜到别人的文件。
            if not inside(root, path):
                continue
            relpath = os.path.relpath(path, root).replace(os.sep, "/")
            scanned += 1
            if mode == "name":
                if low in relpath.lower():
                    matches.append({"path": relpath, "name": name})
            else:
                for number, line in search_lines(path, low):
                    matches.append(
                        {"path": relpath, "name": name, "line": number, "text": line}
                    )
                    if len(matches) > SEARCH_MAX:
                        break
            if len(matches) > SEARCH_MAX or scanned >= SEARCH_FILES_MAX:
                truncated = True
                break
        if truncated:
            break
    return {
        "query": needle,
        "mode": mode,
        "matches": matches[:SEARCH_MAX],
        "truncated": truncated,
        "scanned": scanned,
    }


def browse_file(root, rel):
    """读工作副本里的一个文件，大小、编码与二进制的限制跟未纳管文件预览一致。"""
    rel = browse_rel(rel)
    if not rel:
        raise ApiError(400, "没给文件路径")
    return read_unversioned(root, rel)


def read_unversioned(root, rel):
    """未纳入版本控制的文件没有差异，读内容当整份新增显示。"""
    target = os.path.join(root, rel)
    if not inside(root, target):
        raise ApiError(400, "路径要在工作副本里：%s" % rel)
    if os.path.isdir(target):
        raise ApiError(400, "这是目录，里面没有可直接预览的文件")
    if not os.path.isfile(target):
        raise ApiError(404, "文件不存在：%s" % rel)
    size = os.path.getsize(target)
    if size > MAX_FILE:
        raise ApiError(413, "文件有 %d 字节，超过预览上限 %d" % (size, MAX_FILE))
    data = Path(target).read_bytes()
    if b"\x00" in data:
        raise ApiError(415, "这是二进制文件，看不了内容")
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        raise ApiError(415, "这个文件的编码不是 UTF-8，看不了内容")


def save_file(root, rel, text):
    """把浏览目录里改过的文件按 UTF-8 写回，换行风格跟原来保持一致。"""
    rel = browse_rel(rel)
    if not rel:
        raise ApiError(400, "没给文件路径")
    target = os.path.join(root, rel)
    if not inside(root, target):
        raise ApiError(400, "路径要在工作副本里：%s" % rel)
    if os.path.isdir(target):
        raise ApiError(400, "这是目录，不能按文件保存")
    if not os.path.isfile(target):
        raise ApiError(404, "文件不存在：%s" % rel)
    try:
        old = Path(target).read_bytes()
    except OSError as exc:
        raise ApiError(403, "读不了这个文件：%s" % exc)
    # 只覆盖能被预览的文本，二进制与别的编码不碰。
    if b"\x00" in old:
        raise ApiError(415, "这是二进制文件，不能按文本保存")
    try:
        old.decode("utf-8")
    except UnicodeDecodeError:
        raise ApiError(415, "这个文件的编码不是 UTF-8，不能按文本保存")
    crlf = b"\r\n" in old
    body = text.replace("\r\n", "\n").replace("\r", "\n")
    if crlf:
        body = body.replace("\n", "\r\n")
    raw = body.encode("utf-8")
    try:
        with open(target, "wb") as handle:
            handle.write(raw)
    except OSError as exc:
        raise ApiError(403, "写不了这个文件：%s" % exc)
    return {"path": rel, "size": len(raw)}


def diff_of(root, args):
    rc, out, err = svn(args, cwd=root)
    text = out.decode("utf-8", "replace")
    if rc != 0 and not text:
        raise ApiError(400, err or "svn diff 失败")
    text, truncated = clip(text)
    return {"text": text, "truncated": truncated, "error": err if rc != 0 else ""}


def change_diff(root, rel, rev=None, full=False):
    rel = safe_rel(rel)
    target = os.path.join(root, rel)
    if not inside(root, target):
        raise ApiError(400, "路径要在工作副本里：%s" % rel)
    # 相对工作副本根跑，差异里显示的就是工作副本内的相对路径。
    args = ["diff"]
    if full:
        # 整文件模式：上下文给得足够大，diff 里就是整份文件加改动标记。
        args += ["-x", "-U1000000"]
    if rev:
        args += ["-c", str(rev)]
    args += ["--", rel]
    return diff_of(root, args)


def revision_diff(root, rev, repo_path="", full=False):
    if not (rev or "").isdigit():
        raise ApiError(400, "版本号不对：%s" % rev)
    args = ["diff"]
    if full:
        # 整文件模式：上下文给得足够大，diff 里就是整份文件加改动标记。
        args += ["-x", "-U1000000"]
    args += ["-c", rev]
    if repo_path:
        # 日志里的路径是仓库内绝对路径，^/ 是 svn 在工作副本里认出仓库根的写法。
        args += ["--", "^" + repo_path]
    return diff_of(root, args)


# git 查询

def git(args, cwd=None, timeout=GIT_TIMEOUT, env=None):
    """跑一条 git 命令，返回标准输出与错误文本。找不到 git 与超时都按接口错误报出去。"""
    try:
        cp = subprocess.run(
            ["git", "--no-pager", *args],
            cwd=cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=timeout,
            env=env,
        )
    except subprocess.TimeoutExpired:
        raise ApiError(504, "git 命令超过 %d 秒没跑完：%s" % (timeout, " ".join(args)))
    except OSError as exc:
        raise ApiError(500, "跑不起 git，确认 git 在 PATH 中、目录还在：%s" % exc)
    return cp.returncode, cp.stdout, cp.stderr.decode("utf-8", "replace").strip()


def git_head(root):
    """仓库有没有提交过；空仓库查 status、diff、log 都会在这上面碰壁。"""
    rc, out, _ = git(["rev-parse", "--verify", "HEAD"], cwd=root)
    return rc == 0, out.decode("utf-8", "replace").strip()


def git_info(root):
    rc, out, err = git(["rev-parse", "--show-toplevel"], cwd=root)
    if rc != 0:
        raise ApiError(400, "这个目录不是 Git 仓库：%s" % (err or root))
    top = out.decode("utf-8", "replace").strip()
    has_head, head = git_head(root)
    rc, branch, _ = git(["rev-parse", "--abbrev-ref", "HEAD"], cwd=root)
    branch = branch.decode("utf-8", "replace").strip() if rc == 0 else ""
    rc, remote, _ = git(["remote", "get-url", "origin"], cwd=root)
    remote = remote.decode("utf-8", "replace").strip() if rc == 0 else ""
    return {
        "root": root,
        "top": top,
        # 空仓库没有提交，HEAD 与分支都留空。
        "revision": head[:7] if has_head else "",
        "branch": branch if has_head else "",
        "url": remote,
    }


def detect_vcs(root):
    """认工作副本：先按 SVN 看，不是再看 Git；都不是就拒绝加进列表。"""
    if shutil.which("svn"):
        try:
            return "svn", svn_info(root)
        except ApiError:
            pass
    if shutil.which("git"):
        try:
            return "git", git_info(root)
        except ApiError:
            pass
    missing = " 与 ".join(name for name in ("svn", "git") if not shutil.which(name))
    if missing:
        raise ApiError(400, "没找到 %s 命令，认不出这个目录属于哪种版本控制：%s" % (missing, root))
    raise ApiError(400, "这个目录既不是 SVN 工作副本，也不是 Git 仓库：%s" % root)


def workspace_paths(ws):
    """查文件内容用的根：Git 的路径相对仓库根，SVN 相对登记目录。"""
    if ws.get("vcs") == "git":
        return git_info(ws["root"])["top"]
    return ws["root"]


def git_item(code):
    """把 git status 的两列状态码归到页面认得的那几种。"""
    x, y = code[0], code[1]
    both = x + y
    # 冲突是 UU、AA、DD、AU 这些组合，先认，别落到删除或新增上。
    if "U" in both or both in ("AA", "DD"):
        return "conflicted"
    if x == "?":
        return "unversioned"
    if "R" in both:
        return "renamed"
    if "C" in both:
        return "added"
    if "D" in both:
        return "deleted"
    if "A" in both:
        return "added"
    return "modified"


def parse_git_status(out):
    """git status --porcelain -z 的条目：XY<空格>路径\\0，重命名后面再跟一个原路径字段。"""
    fields = out.decode("utf-8", "replace").split("\0")
    files = []
    untracked = 0
    truncated = False
    i = 0
    while i < len(fields):
        raw = fields[i]
        i += 1
        # 最后一个字段是 \0 之后剩下的空串；不足三列的不是条目。
        if len(raw) < 4:
            continue
        code = raw[:2]
        path = raw[3:]
        if code[0] in "RC":
            i += 1
        item = git_item(code)
        if item == "unversioned":
            untracked += 1
            # 没被 .gitignore 挡住的依赖目录会有成千上万个文件，列到上限就停。
            if untracked > UNVERSIONED_MAX:
                truncated = True
                continue
        files.append({"path": path, "item": item})
    files.sort(key=lambda f: (STATUS_ORDER.get(f["item"], 99), f["path"]))
    return files, truncated


def git_changes(root):
    info = git_info(root)
    rc, out, err = git(["status", "--porcelain", "-z", "-uall", "--", "."], cwd=root)
    if rc != 0:
        raise ApiError(500, err or "git status 失败")
    files, truncated = parse_git_status(out)
    return {"info": info, "files": files, "truncated": truncated}


def git_diff_of(root, args):
    rc, out, err = git(args, cwd=root)
    text = out.decode("utf-8", "replace")
    if rc != 0 and not text:
        raise ApiError(400, err or "git diff 失败")
    text, truncated = clip(text)
    return {"text": text, "truncated": truncated, "error": err if rc != 0 else ""}


def git_change_diff(root, rel, full=False):
    """未提交的改动：工作区加暂存区对 HEAD，口径跟 SVN 对 BASE 一致。"""
    has_head, _ = git_head(root)
    if has_head:
        args = ["diff", "HEAD", "--", ":/" + rel]
    else:
        # 空仓库还没有 HEAD，暂存区里的算新增。
        args = ["diff", "--cached", "--", ":/" + rel]
    if full:
        # 整文件模式：上下文给得足够大，diff 里就是整份文件加改动标记。
        args.insert(1, "--unified=1000000")
    return git_diff_of(root, args)


def git_revision_diff(root, sha, repo_path="", full=False):
    if not re.fullmatch(r"[0-9a-fA-F]{4,40}", sha or ""):
        raise ApiError(400, "提交号不对：%s" % sha)
    # 日志里的路径相对仓库根，:/ 让 git 也按仓库根解释，工作区是子目录时也对得上。
    args = ["show", "--format=", "--no-color", "--find-renames", sha]
    if full:
        args.insert(1, "--unified=1000000")
    if repo_path:
        args += ["--", ":/" + repo_path.lstrip("/")]
    return git_diff_of(root, args)


LOG_FMT = "%x1e%H%x1f%h%x1f%an%x1f%aI%x1f%P%x1f%s"


def parse_git_log(text):
    """git log --name-status 的输出：每条提交一行 \\x1e 开头、\\x1f 分字段，后面跟路径动作行。"""
    entries = []
    current = None
    for line in text.split("\n"):
        if line.startswith("\x1e"):
            parts = line[1:].split("\x1f")
            current = None
            if len(parts) >= 6:
                sha, short, author, date, parents, subject = parts[:6]
                current = {
                    "revision": sha,
                    "short": short,
                    "author": author,
                    "date": date,
                    # 父提交给页面画时间线用；根提交这里是空表。
                    "parents": parents.split(),
                    "message": subject,
                    "paths": [],
                }
                entries.append(current)
            continue
        if current is None or not line.strip():
            continue
        parts = line.split("\t")
        action = parts[0][:1]
        if action in ("R", "C") and len(parts) >= 3:
            # 重命名与复制是“动作 原路径 新路径”，页面点到的是新路径。
            old_path, path = parts[1], parts[2]
        else:
            old_path, path = "", parts[1] if len(parts) > 1 else ""
        if path:
            current["paths"].append(
                {"action": action, "kind": "", "path": path, "copyfrom": old_path}
            )
    return entries


def git_upstream(root):
    """当前分支的远端跟踪分支，形如 origin/main；没配远端或游离 HEAD 就为空。"""
    rc, out, _ = git(
        ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], cwd=root
    )
    name = out.decode("utf-8", "replace").strip()
    return name if rc == 0 and name else ""


def git_ref_exists(root, ref):
    rc, _, _ = git(["rev-parse", "--verify", "--quiet", ref + "^{commit}"], cwd=root)
    return rc == 0


def git_branch(root):
    """当前分支名；游离 HEAD 时 git 给的是 HEAD，原样带回。"""
    rc, out, _ = git(["rev-parse", "--abbrev-ref", "HEAD"], cwd=root)
    name = out.decode("utf-8", "replace").strip()
    return name if rc == 0 else ""


def git_ahead_behind(root, upstream):
    """本地分支与远端跟踪分支各比对方多几个提交，返回 (领先, 落后)。"""
    rc, out, _ = git(["rev-list", "--left-right", "--count", "HEAD..." + upstream], cwd=root)
    if rc != 0:
        return 0, 0
    parts = out.decode("utf-8", "replace").split()
    if len(parts) != 2:
        return 0, 0
    try:
        return int(parts[0]), int(parts[1])
    except ValueError:
        return 0, 0


def git_remote_sync(root, fetch=True):
    """取日志前先同步一次远端，好让列表带上别人最新的提交。

    只更新 .git 里的远端跟踪分支与对象，不动工作区、暂存区，也不合并。
    远端连不上或超时就照旧列已有的记录，把原因带回页面。
    fetch 为假时只读本地已有的远端跟踪分支，翻下一页时不必再连一次。
    """
    meta = {
        "upstream": "",
        "fetched": False,
        "error": "",
        "branch": git_branch(root),
        "ahead": 0,
        "behind": 0,
    }
    upstream = git_upstream(root)
    if not upstream:
        return meta
    meta["upstream"] = upstream
    if fetch:
        remote = upstream.split("/", 1)[0]
        if remote:
            try:
                rc, _, err = git(
                    ["fetch", "--quiet", remote],
                    cwd=root,
                    timeout=FETCH_TIMEOUT,
                    env=git_op_env(),
                )
                if rc != 0:
                    meta["error"] = (err or "git fetch 失败").splitlines()[0]
                else:
                    meta["fetched"] = True
            except ApiError as exc:
                meta["error"] = exc.message
    # 同步失败也按本地已有的远端跟踪分支算，页面照样能看出差多少。
    meta["ahead"], meta["behind"] = git_ahead_behind(root, upstream)
    return meta


def git_remotes(root):
    rc, out, _ = git(["remote"], cwd=root)
    return out.decode("utf-8", "replace").split() if rc == 0 else []


def git_branches(root):
    """本地分支，加上还没有同名本地分支的远端跟踪分支，给页面切换用。"""
    branches = []
    local = set()
    rc, out, _ = git(
        ["for-each-ref", "--format=%(refname:short)%09%(HEAD)%09%(upstream:short)", "refs/heads"],
        cwd=root,
    )
    if rc == 0:
        for line in out.decode("utf-8", "replace").splitlines():
            parts = line.split("\t")
            if len(parts) < 3 or not parts[0]:
                continue
            name, head, upstream = parts[0], parts[1], parts[2]
            local.add(name)
            branches.append(
                {"name": name, "current": head == "*", "upstream": upstream, "remote": False}
            )
    rc, out, _ = git(["for-each-ref", "--format=%(refname:short)", "refs/remotes"], cwd=root)
    if rc == 0:
        for ref in out.decode("utf-8", "replace").split():
            # refs/remotes/origin/feature 在本地要建的分支叫 feature。
            if not ref or ref.endswith("/HEAD") or "/" not in ref:
                continue
            name = ref.split("/", 1)[1]
            if name in local:
                continue
            branches.append(
                {
                    "name": name,
                    "current": False,
                    "upstream": "",
                    "remote": True,
                    "start_point": ref,
                }
            )
    return branches


def git_ref_labels(root):
    """提交号到分支/标签的对应，列表里给提交旁边标引用用。

    附注标签要取它指到的提交号：%(objectname) 是标签对象本身，*objectname 才是提交。
    """
    fmt = "%(objectname)%09%(*objectname)%09%(refname:short)%09%(refname)"
    rc, out, _ = git(
        ["for-each-ref", "--format=" + fmt, "refs/heads", "refs/remotes", "refs/tags"],
        cwd=root,
    )
    labels = {}
    if rc != 0:
        return labels
    for line in out.decode("utf-8", "replace").splitlines():
        parts = line.split("\t")
        if len(parts) < 4 or not parts[0]:
            continue
        sha, peeled, short, full = parts[0], parts[1] or parts[0], parts[2], parts[3]
        # 远端仓库的 HEAD 是符号引用，短名会缩成远端名，别当成一个分支标出来。
        if full.startswith("refs/remotes/") and full.endswith("/HEAD"):
            continue
        if full.startswith("refs/heads/"):
            kind = "head"
        elif full.startswith("refs/tags/"):
            kind = "tag"
        else:
            kind = "remote"
        labels.setdefault(peeled, []).append({"name": short, "kind": kind})
    return labels


def git_op_env():
    """写操作的 git 环境：没人看着终端，不能让命令停在密码或口令提示上。"""
    env = dict(os.environ)
    env["GIT_TERMINAL_PROMPT"] = "0"
    env.setdefault("GIT_SSH_COMMAND", "ssh -o BatchMode=yes")
    env["GIT_EDITOR"] = "true"
    env["GIT_SEQUENCE_EDITOR"] = "true"
    # 合并时不要打开编辑器等一份提交说明。
    env["GIT_MERGE_AUTOEDIT"] = "no"
    return env


def git_op(root, args, label):
    """跑一条会动工作区或远端的 git 命令，把输出原样带回页面。

    非零退出不抛接口错误：冲突、认证失败这类原因都写在输出里，
    页面要能完整看到；是否成功由 ok 告诉调用方。
    """
    try:
        cp = subprocess.run(
            ["git", "--no-pager", *args],
            cwd=root,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=OPERATION_TIMEOUT,
            env=git_op_env(),
        )
    except subprocess.TimeoutExpired:
        raise ApiError(504, "git %s 超过 %d 秒没跑完" % (label, OPERATION_TIMEOUT))
    except OSError as exc:
        raise ApiError(500, "跑不起 git：%s" % exc)
    out = cp.stdout.decode("utf-8", "replace")
    err = cp.stderr.decode("utf-8", "replace")
    text = "\n".join(part.strip() for part in (out, err) if part.strip())
    tail = err.strip().splitlines()[-1] if err.strip() else ""
    return {
        "ok": cp.returncode == 0,
        "command": "git " + " ".join(args),
        "output": text,
        "error": "" if cp.returncode == 0 else (tail or "git %s 失败，退出码 %d" % (label, cp.returncode)),
    }


def git_pull_args(root, mode="ff"):
    """拉取当前分支的远端跟踪分支；默认只快进，不擅自合并或变基。"""
    upstream = git_upstream(root)
    if not upstream:
        raise ApiError(400, "当前分支没有远端跟踪分支，先在终端里设一次再拉取")
    if mode == "ff":
        return ["pull", "--ff-only"]
    if mode == "merge":
        return ["pull", "--no-rebase", "--no-edit"]
    if mode == "rebase":
        return ["pull", "--rebase"]
    raise ApiError(400, "拉取方式不对：%s" % mode)


def git_pull(root, mode="ff"):
    return git_op(root, git_pull_args(root, mode), "pull")


def git_push_args(root, set_upstream=False):
    """把当前分支推到它的远端跟踪分支；没有上游时可以一并设置。不强制推送。"""
    branch = git_branch(root)
    if not branch or branch == "HEAD":
        raise ApiError(400, "当前是游离 HEAD，先切到一个分支再推送")
    if git_upstream(root):
        return ["push"]
    if not set_upstream:
        raise ApiError(400, "当前分支没有远端跟踪分支，勾选设置上游后再推送")
    remotes = git_remotes(root)
    if "origin" in remotes:
        remote = "origin"
    elif len(remotes) == 1:
        remote = remotes[0]
    else:
        raise ApiError(400, "没有可用的远端，先在终端里配一个 remote")
    return ["push", "-u", remote, branch]


def git_push(root, set_upstream=False):
    return git_op(root, git_push_args(root, set_upstream), "push")


def git_checkout_args(root, body):
    """切分支的参数：本地分支直接切，远端分支建跟踪分支，新建分支从当前提交起。

    工作区有未提交的改动且会被切换覆盖时，git switch 自己会拒绝，输出原样带回页面。
    """
    branch = str(body.get("branch", "")).strip()
    if not branch:
        raise ApiError(400, "没给分支名")
    if branch.startswith("-"):
        raise ApiError(400, "分支名不合法：%s" % branch)
    # 名字再交给 git 校验，规则与终端里 git branch 一致。
    rc, _, _ = git(["check-ref-format", "--branch", branch], cwd=root)
    if rc != 0:
        raise ApiError(400, "分支名不合法：%s" % branch)
    start = str(body.get("start_point", "")).strip()
    if start or body.get("create"):
        if start:
            if not git_ref_exists(root, start):
                raise ApiError(400, "没有这个分支：%s" % start)
            return ["switch", "--track", "-c", branch, start]
        if not git_head(root)[0]:
            raise ApiError(400, "仓库还没有提交，先切到一个已有分支或做一次提交")
        return ["switch", "-c", branch]
    if not git_ref_exists(root, "refs/heads/" + branch):
        raise ApiError(404, "没有这个本地分支：%s" % branch)
    return ["switch", branch]


def git_commit_commands(root, message, paths):
    """把选中的路径暂存后提交。

    先 git add 再 git commit，不带路径限制：重命名与删除只有提交整个索引
    才会一起进提交。为避免把别处暂存的东西带进来，先看索引里有没有未选中的
    暂存改动，有就拒绝，让用户先处理。
    """
    message = (message or "").strip()
    if not message:
        raise ApiError(400, "提交说明不能为空")
    if len(message) > COMMIT_MESSAGE_MAX:
        raise ApiError(400, "提交说明太长，最多 %d 字" % COMMIT_MESSAGE_MAX)
    if not isinstance(paths, list) or not paths:
        raise ApiError(400, "没有选中要提交的路径")
    clean = []
    for rel in paths:
        rel = safe_rel(str(rel))
        if not inside(root, os.path.join(root, rel)):
            raise ApiError(400, "路径要在工作副本里：%s" % rel)
        clean.append(rel)
    # 冲突路径不提交，免得把冲突标记当成解决结果。
    rc, out, err = git(["status", "--porcelain", "-z", "-uall", "--", "."], cwd=root)
    if rc != 0:
        raise ApiError(500, err or "git status 失败")
    files, _ = parse_git_status(out)
    conflicts = {item["path"] for item in files if item["item"] == "conflicted"}
    hit = [rel for rel in clean if rel in conflicts]
    if hit:
        raise ApiError(400, "这些路径还有冲突，先解决再提交：%s" % "、".join(hit))
    # 索引里已有的暂存改动必须在勾选范围内，否则提交整个索引会带上它们。
    rc, out, err = git(["diff", "--cached", "--name-only", "-z"], cwd=root)
    if rc != 0:
        raise ApiError(500, err or "git diff --cached 失败")
    staged = [item for item in out.decode("utf-8", "replace").split("\0") if item]
    extra = [item for item in staged if item not in set(clean)]
    if extra:
        raise ApiError(
            400,
            "索引里还有未选中的暂存改动：%s；先提交或取消暂存再试" % "、".join(extra[:10]),
        )
    return [
        ["git", "--no-pager", "add", "-A", "--", *clean],
        ["git", "--no-pager", "commit", "-m", message],
    ]


def operation_plan(ws, body):
    """把页面发来的操作变成一串可执行命令，参数与超时都在这里定。"""
    action = str(body.get("action", "")).strip()
    if ws.get("vcs") == "git":
        if action == "pull":
            commands = [
                ["git", "--no-pager", *git_pull_args(ws["root"], str(body.get("mode", "ff")))]
            ]
        elif action == "push":
            commands = [
                ["git", "--no-pager", *git_push_args(ws["root"], bool(body.get("set_upstream")))]
            ]
        elif action == "checkout":
            commands = [["git", "--no-pager", *git_checkout_args(ws["root"], body)]]
        elif action == "commit":
            commands = git_commit_commands(
                ws["root"],
                str(body.get("message", "")),
                body.get("paths") or [],
            )
        else:
            raise ApiError(400, "Git 工作区不支持这个操作：%s" % action)
        env = git_op_env()
    else:
        if action == "update":
            commands = [["svn", "--non-interactive", *svn_update_args()]]
        elif action == "commit":
            commands = [
                [
                    "svn",
                    "--non-interactive",
                    *svn_commit_args(
                        ws["root"],
                        str(body.get("message", "")),
                        body.get("paths") or [],
                    ),
                ]
            ]
        else:
            raise ApiError(400, "SVN 工作区不支持这个操作：%s" % action)
        env = dict(os.environ)
    return {
        "action": action,
        "commands": commands,
        "cwd": ws["root"],
        "env": env,
        "command": " && ".join(shlex.join(argv) for argv in commands),
    }


def git_sync_info(root):
    info = git_info(root)
    upstream = git_upstream(root)
    ahead, behind = git_ahead_behind(root, upstream) if upstream else (0, 0)
    branch = info["branch"]
    rc, out, _ = git(["status", "--porcelain", "-z", "-uall", "--", "."], cwd=root)
    files, truncated = parse_git_status(out) if rc == 0 else ([], False)
    return {
        **info,
        "vcs": "git",
        "upstream": upstream,
        "ahead": ahead,
        "behind": behind,
        "detached": not branch or branch == "HEAD",
        "remotes": git_remotes(root),
        "branches": git_branches(root),
        "has_head": bool(info["revision"]),
        "files": files,
        "truncated": truncated,
    }


def git_commit_detail(root, sha):
    """一次提交的完整说明与父提交；日志列表里只放得下第一行。"""
    if not re.fullmatch(r"[0-9a-fA-F]{4,40}", sha or ""):
        raise ApiError(400, "提交号不对：%s" % sha)
    fmt = "%H%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%P%x1f%D%x1f%B"
    rc, out, err = git(["show", "-s", "--no-color", "--format=" + fmt, sha], cwd=root)
    if rc != 0:
        raise ApiError(400, err or "读不了这个提交")
    parts = out.decode("utf-8", "replace").split("\x1f", 7)
    if len(parts) < 8:
        raise ApiError(500, "git 返回的提交信息读不懂")
    full, short, author, email, date, parents, refs, body = parts
    return {
        "revision": full.strip(),
        "short": short.strip(),
        "author": author.strip(),
        "email": email.strip(),
        "date": date.strip(),
        "parents": parents.split(),
        "refs": [item.strip() for item in refs.split(",") if item.strip()],
        "message": body.strip("\n"),
    }


def git_log(root, limit, upstream="", skip=0, all_refs=False):
    has_head, head = git_head(root)
    if not has_head:
        return []
    # 本地分支与远端跟踪分支一起列：还没拉进本地分支的提交也要看得见。
    tracking = bool(upstream) and git_ref_exists(root, upstream)
    if all_refs:
        # --branches/--remotes/--tags 代替 HEAD 一个引用，时间线才看得到分叉与合并。
        revs = ["HEAD", "--branches", "--remotes", "--tags"]
    else:
        revs = ["HEAD", upstream] if tracking else ["HEAD"]
    # --topo-order 保证子提交排在父提交前面，页面按列表顺序画连线不会错位。
    # -- . 让登记的是仓库子目录时只列这个子目录的提交，跟 svn log 从子目录跑一致。
    rc, out, err = git(
        [
            "log", "-n", str(limit), "--skip=%d" % skip,
            "--no-color", "--name-status", "--topo-order",
            # 路径过滤默认会把没改这个目录的合并提交省掉，时间线就断开了；--full-history 留住它们。
            "--full-history",
            "--date=iso-strict", "--format=" + LOG_FMT, *revs, "--", ".",
        ],
        cwd=root,
    )
    if rc != 0:
        raise ApiError(500, err or "git log 失败")
    entries = parse_git_log(out.decode("utf-8", "replace"))
    # 标出每条提交的位置：在所有本地分支上、已经进了远端分支，还是只在远端。
    local_revs = ["HEAD", "--branches"] if all_refs else ["HEAD"]
    rc, out, _ = git(["rev-list", *local_revs, "--", "."], cwd=root)
    local = set(out.decode("utf-8", "replace").split()) if rc == 0 else set()
    pushed = set()
    tip = ""
    if tracking:
        rc, out, _ = git(["rev-parse", "--verify", "--quiet", upstream + "^{commit}"], cwd=root)
        tip = out.decode("utf-8", "replace").strip() if rc == 0 else ""
    # 全部引用时按“在任意远端跟踪分支上”算，单查当前上游会把别的远端分支误标成未推送；
    # 仓库根本没有远端时不标，免得每条都写“未推送”。
    has_remote = bool(git_remotes(root))
    if tracking or (all_refs and has_remote):
        pushed_revs = ["--remotes"] if all_refs else [upstream]
        rc, out, _ = git(["rev-list", *pushed_revs, "--", "."], cwd=root)
        pushed = set(out.decode("utf-8", "replace").split()) if rc == 0 else set()
    labels = git_ref_labels(root)
    for entry in entries:
        revision = entry["revision"]
        entry["local"] = revision in local
        entry["head"] = revision == head
        entry["labels"] = labels.get(revision, [])
        if tracking or (all_refs and has_remote):
            entry["pushed"] = revision in pushed
        if tracking:
            entry["remote_tip"] = revision == tip
    return entries


def changes_signature(ws):
    """工作副本当前状态的指纹：状态输出与分支或版本号一起哈希，变了才提醒页面。"""
    if ws.get("vcs") == "git":
        rc, out, _ = git(["status", "--porcelain", "-z", "-uall", "--", "."], cwd=ws["root"])
        if rc != 0:
            return None, 0
        files, _ = parse_git_status(out)
        has_head, head = git_head(ws["root"])
        rc, branch, _ = git(["rev-parse", "--abbrev-ref", "HEAD"], cwd=ws["root"])
        sig = hashlib.sha1(out)
        sig.update(head.encode("utf-8") if has_head else b"")
        if rc == 0:
            sig.update(branch)
        return sig.hexdigest(), len(files)
    rc, out, _ = svn(["status", "--xml"], cwd=ws["root"])
    if rc != 0:
        return None, 0
    return hashlib.sha1(out).hexdigest(), len(parse_status(out))


def list_dirs(raw):
    """目录树：没给路径就列家目录这一层，给了就列它的下一层；只给目录，不递归。"""
    home = os.path.expanduser("~")
    target = os.path.expanduser(raw.strip()) if raw and raw.strip() else home
    target = os.path.abspath(target)
    if not inside(home, target) and target != home:
        raise ApiError(403, "只能浏览家目录内的目录")
    if not os.path.isdir(target):
        raise ApiError(404, "目录不存在：%s" % target)
    entries = []
    try:
        with os.scandir(target) as it:
            for entry in it:
                if not entry.is_dir(follow_symlinks=False):
                    continue
                if entry.name.startswith("."):
                    continue
                entries.append({"name": entry.name, "path": entry.path})
    except OSError as exc:
        raise ApiError(403, "读不了目录：%s" % exc)
    entries.sort(key=lambda e: e["name"].lower())
    return {"home": home, "path": target, "entries": entries}


# HTTP


class Handler(WebHandler):
    server_version = "dvcsx-web"

    static = None
    store = None
    state_stream = None
    api_prefix = "/__dvcsx/api"
    # 写操作默认只认本机；--allow-write 把它放开给所有能打开页面的人。
    allow_write = False

    def _error_log(self, msg):
        # 这一侧的日志带时间戳，骨架里的默认写法没有。
        log(msg)

    def _stream_routes(self, route, query):
        # SSE 自己写响应头与数据流，不走一次性回 JSON 的路。
        if route == "state/stream":
            self._sse_state()
            return True
        if route == "events":
            self._sse_workspace(query)
            return True
        match = re.fullmatch(r"operations/([0-9a-zA-Z_-]+)/events", route)
        if match:
            self._sse_job(match.group(1))
            return True
        return False

    def _dispatch(self, method, route, query, body):
        if route == "state":
            return {"workspaces": self.store.workspaces()}
        if route == "dirs":
            return list_dirs((query.get("path") or [""])[0])
        if route == "changes":
            return self._changes(query)
        if route == "diff":
            return self._diff(query)
        if route == "log":
            return self._log(query)
        if route == "revision":
            return self._revision(query)
        if route == "commit":
            return self._commit_detail(query)
        if route == "sync-info":
            return self._sync_info(query)
        if route == "tree":
            return self._tree(query)
        if route == "file":
            return self._file(query)
        if route == "search":
            return self._search(query)
        if route == "download":
            return self._download(query, head=(method == "HEAD"))
        if route == "operations" and method == "GET":
            return self._latest_job(query)
        match = re.fullmatch(r"operations/([0-9a-zA-Z_-]+)", route)
        if match and method == "GET":
            return self._job_json(match.group(1))
        if method != "POST":
            raise ApiError(405, "这个接口只接受 POST")
        if route == "workspaces":
            root = str(body.get("root", "")).strip()
            if not root:
                raise ApiError(400, "没给目录")
            item = self.store.add(root)
            return {"ok": True, "workspace": item}
        if route == "forget":
            self.store.remove(str(body.get("ws", "")))
            return {"ok": True}
        if route == "alias":
            ws = self.store.find(str(body.get("ws", "")))
            if ws is None:
                raise ApiError(404, "没有这个工作区")
            self.store.set_alias(ws["id"], str(body.get("alias", "")))
            return {"ok": True}
        if route == "save":
            return self._save(body)
        if route == "operations":
            return self._start_operation(body)
        match = re.fullmatch(r"operations/([0-9a-zA-Z_-]+)/cancel", route)
        if match:
            return self._cancel_job(match.group(1))
        raise ApiError(404, "没有这个接口：%s" % route)

    def _ws(self, query):
        wid = (query.get("ws") or [""])[0]
        item = self.store.find(wid)
        if item is None:
            raise ApiError(404, "没有这个工作区：%s" % wid)
        return item

    def _changes(self, query):
        ws = self._ws(query)
        if ws.get("vcs") == "git":
            return {"workspace": ws, **git_changes(ws["root"])}
        info = svn_info(ws["root"])
        rc, out, err = svn(["status", "--xml"], cwd=ws["root"])
        if rc != 0:
            raise ApiError(500, err or "svn status 失败")
        files, truncated = expand_unversioned(ws["root"], parse_status(out))
        return {"workspace": ws, "info": info, "files": files, "truncated": truncated}

    def _diff(self, query):
        ws = self._ws(query)
        rel = safe_rel((query.get("path") or [""])[0])
        rev = (query.get("rev") or [""])[0] or None
        item = (query.get("item") or [""])[0]
        full = (query.get("full") or ["0"])[0] == "1"
        # 未纳入版本控制的文件没有差异，读整份内容按新增显示。
        if not rev and item == "unversioned":
            text, truncated = clip(read_unversioned(workspace_paths(ws), rel))
            return {"kind": "file", "path": rel, "text": text, "truncated": truncated}
        if ws.get("vcs") == "git":
            result = git_change_diff(ws["root"], rel, full)
        else:
            result = change_diff(ws["root"], rel, rev, full)
        result.update({"kind": "diff", "path": rel})
        return result

    def _log(self, query):
        ws = self._ws(query)
        try:
            limit = int((query.get("limit") or [str(LOG_DEFAULT)])[0])
        except ValueError:
            limit = LOG_DEFAULT
        limit = max(1, min(LOG_MAX, limit))
        try:
            skip = int((query.get("skip") or ["0"])[0] or 0)
        except ValueError:
            skip = 0
        skip = max(0, min(LOG_SKIP_MAX, skip))
        # 翻下一页时不必再连远端同步一次。
        sync = (query.get("sync") or ["1"])[0] != "0"
        # 时间线默认连本地分支、远端跟踪分支与标签一起列；只要当前分支时传 all=0。
        all_refs = (query.get("all") or ["1"])[0] != "0"
        if ws.get("vcs") == "git":
            remote = git_remote_sync(ws["root"], fetch=sync and skip == 0)
            entries = git_log(ws["root"], limit, remote["upstream"], skip, all_refs)
            return {"workspace": ws, "entries": entries, "remote": remote}
        entries, remote = svn_log_meta(ws["root"], limit, skip)
        return {"workspace": ws, "entries": entries, "remote": remote}

    def _revision(self, query):
        ws = self._ws(query)
        rev = (query.get("rev") or [""])[0]
        repo_path = (query.get("path") or [""])[0]
        full = (query.get("full") or ["0"])[0] == "1"
        if ws.get("vcs") == "git":
            result = git_revision_diff(ws["root"], rev, repo_path, full)
        else:
            result = revision_diff(ws["root"], rev, repo_path, full)
        result.update({"kind": "diff", "rev": rev, "path": repo_path})
        return result

    def _tree(self, query):
        ws = self._ws(query)
        rel = (query.get("path") or [""])[0]
        return {"workspace": ws, **browse_list(ws["root"], rel)}

    def _file(self, query):
        ws = self._ws(query)
        rel = (query.get("path") or [""])[0]
        return {"workspace": ws, "path": rel, "text": browse_file(ws["root"], rel)}

    def _download(self, query, head=False):
        ws = self._ws(query)
        rel = browse_rel((query.get("path") or [""])[0])
        root = ws["root"]
        target = os.path.join(root, rel) if rel else root
        if not inside(root, target):
            raise ApiError(400, "路径要在工作副本里：%s" % rel)
        if os.path.isdir(target):
            path, _ = zip_dir(target, BROWSE_SKIP)
            name = (os.path.basename(target.rstrip("/")) or "download") + ".zip"
            try:
                self._send_download(path, name, head=head)
            finally:
                os.unlink(path)
            return STREAMED
        if not os.path.isfile(target):
            raise ApiError(404, "没有这个文件：%s" % (rel or "根目录"))
        self._send_download(target, os.path.basename(target), head=head)
        return STREAMED

    def _save(self, body):
        self._check_write()
        ws = self.store.find(str(body.get("ws", "")))
        if ws is None:
            raise ApiError(404, "没有这个工作区")
        rel = str(body.get("path", ""))
        text = body.get("text", "")
        if not isinstance(text, str):
            raise ApiError(400, "文件内容要是文本")
        return {"workspace": ws, **save_file(ws["root"], rel, text)}

    def _search(self, query):
        ws = self._ws(query)
        rel = (query.get("path") or [""])[0]
        text = (query.get("q") or [""])[0]
        mode = (query.get("mode") or ["name"])[0]
        return {"workspace": ws, **browse_search(ws["root"], rel, text, mode)}

    def _commit_detail(self, query):
        ws = self._ws(query)
        rev = (query.get("rev") or [""])[0]
        if ws.get("vcs") == "git":
            data = git_commit_detail(ws["root"], rev)
        else:
            data = svn_commit_detail(ws["root"], rev)
        return {"workspace": ws, **data}

    def _sync_info(self, query):
        ws = self._ws(query)
        if ws.get("vcs") == "git":
            data = git_sync_info(ws["root"])
        else:
            data = svn_sync_info(ws["root"])
        # 让页面提前知道能不能写，省得从别的机器点完按钮才吃到 403。
        writable = self.allow_write or is_loopback(self.client_address[0])
        return {"workspace": ws, **data, "writable": writable}

    def _start_operation(self, body):
        self._check_write()
        ws = self.store.find(str(body.get("ws", "")))
        if ws is None:
            raise ApiError(404, "没有这个工作区")
        # 参数不合法时先报错，别占住工作副本锁。
        plan = operation_plan(ws, body)
        lock = workspace_lock(ws["id"])
        # 同一个工作副本同时只跑一个写操作，撞上了让用户等前一个跑完。
        if not lock.acquire(blocking=False):
            raise ApiError(409, "这个工作副本正有一个操作在执行，等它跑完再试")
        try:
            job = Job(
                ws["id"],
                plan["action"],
                plan["commands"],
                plan["cwd"],
                plan["env"],
                plan["command"],
            )
            JOBS.add(job)
            threading.Thread(target=run_job, args=(job, lock, HUB), daemon=True).start()
        except Exception:
            lock.release()
            raise
        return {"ok": True, "id": job.id, "action": job.action, "command": job.command}

    def _job_json(self, job_id):
        job = JOBS.get(job_id)
        if job is None:
            raise ApiError(404, "没有这个任务")
        return job.snapshot()

    def _latest_job(self, query):
        ws = self._ws(query)
        job = JOBS.latest(ws["id"])
        return {"workspace": ws, "job": job.snapshot() if job else None}

    def _cancel_job(self, job_id):
        self._check_write()
        job = JOBS.get(job_id)
        if job is None:
            raise ApiError(404, "没有这个任务")
        job.cancel()
        return {"ok": True}

    # SSE

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

    # 安全与请求体

    def _check_write(self):
        if self.allow_write or is_loopback(self.client_address[0]):
            return
        raise ApiError(403, "写操作只允许本机发起；要放开给其他机器，用 --allow-write 启动")


def serve(args):
    static = Path(args.static).resolve()
    if not (static / "index.html").is_file():
        log("缺 %s/index.html，前端还没打包" % static)
        return 3
    if not (shutil.which("svn") or shutil.which("git")):
        log("找不到 svn 与 git 命令，装上其中一个再试")
        return 3

    Handler.static = static
    Handler.store = Workspaces(args.state)
    Handler.api_prefix = args.api
    Handler.allow_write = args.allow_write
    Handler.state_stream = StateStream(args.state, lambda: {"workspaces": Handler.store.workspaces()})
    Handler.state_stream.start()

    try:
        httpd = WebServer((args.host, args.port), Handler)
    except OSError as exc:
        log("端口 %s 用不了：%s" % (args.port, exc))
        return 1
    httpd.daemon_threads = True
    port = httpd.server_address[1]
    host = guess_host() if is_any(args.host) else args.host
    url = "http://%s:%d/" % (host, port)

    print("DVCSX_WEB_READY %s:%d" % (host, port), flush=True)
    log("dvcsx 网页：%s" % url)

    def shutdown(signum, frame):
        log("收到信号 %d，退出" % signum)
        threading.Thread(target=httpd.shutdown, daemon=True).start()

    import signal

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
    parser = argparse.ArgumentParser(prog="dvcsx-web", description="dvcsx 网页模式的转发进程")
    parser.add_argument("--static", required=True, help="打包好的页面目录")
    parser.add_argument("--state", required=True, help="工作区登记文件")
    parser.add_argument("--api", default="/__dvcsx/api", help="接口前缀")
    parser.add_argument("--host", default="0.0.0.0", help="监听地址，默认所有网卡")
    parser.add_argument("--port", type=int, default=0, help="监听端口，默认 0 由系统挑")
    parser.add_argument(
        "--allow-write",
        action="store_true",
        help="允许其他机器发起拉取、推送、切换分支、更新与提交；默认只认本机",
    )
    parser.add_argument("--open", action="store_true", help="起来后打开浏览器")
    return serve(parser.parse_args(argv))


if __name__ == "__main__":
    sys.exit(main())
