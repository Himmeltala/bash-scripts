#!/usr/bin/env python3
"""dvcsx 网页模式的转发进程：静态页面加 SVN / Git 查询与操作接口，只用标准库。

页面要的东西都由这里现跑 svn 或 git 命令取：工作副本变更、单个文件的差异、
提交日志、某次提交的完整说明，以及直接浏览工作副本的目录与文件内容。
查询只读；拉取、推送、切换分支、更新与提交会动工作副本或远端，只接受本机请求，
要放开到其他机器得用 --allow-write 启动。工作副本变化与操作输出走 SSE。
"""

import argparse
import hashlib
import json
import os
import queue
import re
import shlex
import shutil
import signal
import subprocess
import sys
import threading
import time
import uuid
import webbrowser
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import unquote, urlparse

# 共用骨架在仓库根的 lib/py-shared 下，源码与安装后的相对层级一致。
sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "lib" / "py-shared" / "commons"))
sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "lib" / "py-shared" / "services"))
# 同目录下的 LSP 桥接；按文件加载本模块时也能找到。
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lsp_client import LspError, LspManager, LspUnavailable, apply_workspace_edit
from fileio import PreviewError, read_json, read_text_preview, write_json, write_text_preserve_newlines
from metrics import Metrics
from netutil import is_loopback_address as is_loopback
from pathutil import PathError, safe_relative, within
from sse import MetricsStream
from stores import LayoutStore
from routes_lsp import LspRoutes
from web import ApiError, STREAMED, WebHandler, WebServer, guess_host, is_any, zip_dir
from server_common import MAX_FILE, inside, safe_rel, workspace_lock
from vcs_cli import GIT_TIMEOUT, SVN_TIMEOUT, git, svn
from browse_fs import browse_file, browse_files, browse_list, browse_rel, browse_search, delete_entry, make_entry, read_unversioned, rename_entry, save_file
from routes_browse import BrowseRoutes
from vcs_query import FETCH_TIMEOUT, LOG_DEFAULT, LOG_FMT, LOG_MAX, LOG_SKIP_MAX, MAX_TEXT, STATUS_ORDER, UNVERSIONED_MAX, UNVERSIONED_SKIP, WIDE_LINE, change_diff, changes_payload, clean_paths, clip, column_item, diff_of, expand_unversioned, git_ahead_behind, git_branch, git_branches, git_change_diff, git_changes, git_commit_detail, git_diff_of, git_head, git_info, git_item, git_log, git_op_env, git_ref_exists, git_ref_labels, git_remote_sync, git_remotes, git_revision_diff, git_stage_args, git_sync_info, git_unstage_args, git_upstream, is_wide, node_text, parse_git_log, parse_git_status, parse_log, parse_name_status, parse_status, revision_diff, split_status, svn_add_args, svn_add_paths, svn_commit_detail, svn_entry_local, svn_info, svn_log_meta, svn_status_state, svn_sync_info, svn_unadd_args, svn_unadd_paths, svn_working_revisions, unversioned_files, workspace_paths, xml_of, detect_vcs
from routes_vcs import VcsRoutes

# 一次回给页面的文本上限：大文件的整份差异撑不住页面，截断后照样能看开头。
# 单行超过这个宽度按大文件处理：压缩过的 JS/CSS 一行几十万字符，页面渲染不动。
# 未纳入版本控制的文件没有差异可算，直接读内容预览，超过这个大小就不给。
SVN_TIMEOUT = 30
GIT_TIMEOUT = 30
# fetch 是取日志前顺手同步远端，等太久就把页面拖住了，超时先按本地记录出。
# 浏览目录时一层最多回这么多项，再多的目录列出来也翻不动。
# 快速打开要一次列出工作副本里的文件，到上限就停。
# 浏览目录的搜索：命中与扫过的文件都设上限，大工作副本不至于把页面拖住。
# 搜索默认跳过的目录名，按名字在工作副本里任何一层匹配；设置页可以改。
SEARCH_IGNORE_DEFAULTS = [".git", ".svn", ".hg", "node_modules", "__pycache__", "dist", "build", "target"]
SEARCH_IGNORE_MAX = 50
SEARCH_IGNORE_LEN = 80
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
# 页面头部的性能指标只采一份给所有页面。
METRICS = Metrics()


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
        last_revision = None
        while True:
            with self.lock:
                if not self.subs.get(wid):
                    self.subs.pop(wid, None)
                    self.watchers.pop(wid, None)
                    return
            try:
                signature, count, revision = changes_signature(ws)
            except Exception:
                signature, count, revision = None, 0, None
            # 第一次也推一次：连接建立前后刚发生的改动不会漏掉，页面重载一次无妨。
            if signature is not None and signature != last:
                self.broadcast(wid, "changes", {"ws": wid, "count": count})
            if signature is not None:
                last = signature
            # 版本变了说明外面提交或更新过，日志与同步页也要重读。
            if revision is not None and revision != last_revision:
                self.broadcast(wid, "head", {"ws": wid, "revision": revision})
            if revision is not None:
                last_revision = revision
            time.sleep(WATCH_INTERVAL)


class StateStream:
    """登记表一变就推一份给所有页面；页面不用再定时来取。"""

    def __init__(self, paths, build):
        # 登记表与分组结构各一个文件，哪个变了都推一份；只给一个路径也照收。
        if isinstance(paths, (str, Path)):
            paths = [paths]
        self.paths = [Path(p) for p in paths]
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
        while True:
            mtimes = self._mtimes()
            if mtimes != seen:
                seen = mtimes
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
        data = read_json(self.path, default=None)
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
        write_json(self.path, {"workspaces": items}, indent=2, ensure_ascii=False)

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


def clean_search_ignore(values):
    """只收目录名：去空白、去重，带路径分隔符的条目丢掉，数量与长度都设上限。"""
    names = []
    for value in values if isinstance(values, (list, tuple)) else []:
        name = str(value).strip()
        if not name or name in (".", "..") or "/" in name or "\\" in name:
            continue
        if len(name) > SEARCH_IGNORE_LEN or name in names:
            continue
        names.append(name)
        if len(names) >= SEARCH_IGNORE_MAX:
            break
    return names


class Settings:
    """全局设置，存在 settings.json 里；现在只管搜索要跳过哪些目录名。"""

    def __init__(self, path):
        self.path = Path(path)
        self.lock = threading.Lock()

    def data(self):
        value = read_json(self.path, default=None)
        return value if isinstance(value, dict) else {}

    def search_ignore(self):
        values = self.data().get("search_ignore")
        if not isinstance(values, list):
            return list(SEARCH_IGNORE_DEFAULTS)
        return clean_search_ignore(values)

    def set_search_ignore(self, values):
        with self.lock:
            names = clean_search_ignore(values)
            data = self.data()
            data["search_ignore"] = names
            write_json(self.path, data, indent=2, ensure_ascii=False)
            return names


# svn 查询









# 状态字母与中文名的对应只在页面上用，这里原样给 svn 的 item 值。




# svn status 只报未纳入版本控制的目录本身，页面要能点到里面的文件，这里展开一层层。
# 依赖与产物目录不展开：它们动辄上千个文件，列出来也没人一个个看。












def svn_log(root, limit):
    """读日志，并标出哪些提交已经随工作副本更新到了本地。"""
    entries, _ = svn_log_meta(root, limit)
    return entries




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






































# 浏览目录的增删改：新建、改名、删除。已纳管的交给 svn 与 git，保住历史；
# 未纳管的直接动磁盘。新建只落盘，要不要纳入版本控制留给提交页决定。



























# git 查询

























































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


def git_commit_commands(root, message, stage_all=False):
    """只提交索引里的暂存内容。

    页面勾选即暂存，提交不再接受路径；未暂存的文件留在工作区不提交。
    stage_all 时先整目录 git add -A。有冲突时一律拒绝，免得把冲突标记
    当成解决结果提交。
    """
    message = (message or "").strip()
    if not message:
        raise ApiError(400, "提交说明不能为空")
    if len(message) > COMMIT_MESSAGE_MAX:
        raise ApiError(400, "提交说明太长，最多 %d 字" % COMMIT_MESSAGE_MAX)
    rc, out, err = git(["status", "--porcelain", "-z", "-uall", "--", "."], cwd=root)
    if rc != 0:
        raise ApiError(500, err or "git status 失败")
    files, _ = parse_git_status(out)
    conflicts = [item["path"] for item in files if item["item"] == "conflicted"]
    if conflicts:
        raise ApiError(400, "这些路径还有冲突，先解决再提交：%s" % "、".join(conflicts[:10]))
    commands = []
    if stage_all:
        commands.append(["git", "--no-pager", "add", "-A", "--", "."])
    else:
        rc, out, err = git(["diff", "--cached", "--name-only", "-z"], cwd=root)
        if rc != 0:
            raise ApiError(500, err or "git diff --cached 失败")
        staged = [item for item in out.decode("utf-8", "replace").split("\0") if item]
        if not staged:
            raise ApiError(400, "索引里没有暂存内容")
    commands.append(["git", "--no-pager", "commit", "-m", message])
    return commands


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
                bool(body.get("stage_all")),
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








def changes_signature(ws):
    """工作副本当前状态的指纹，外加当前指向的版本。

    指纹变了才提醒页面；版本变了说明外面提交或更新过，日志与同步页要重读。
    """
    # 普通目录没有版本控制可查，页面也只开浏览目录，不接这条推送。
    if ws.get("vcs") == "none":
        return None, 0, None
    if ws.get("vcs") == "git":
        rc, out, _ = git(["status", "--porcelain", "-z", "-uall", "--", "."], cwd=ws["root"])
        if rc != 0:
            return None, 0, None
        files, _ = parse_git_status(out)
        has_head, head = git_head(ws["root"])
        rc, branch, _ = git(["rev-parse", "--abbrev-ref", "HEAD"], cwd=ws["root"])
        sig = hashlib.sha1(out)
        sig.update(head.encode("utf-8") if has_head else b"")
        if rc == 0:
            sig.update(branch)
        return sig.hexdigest(), len(files), head if has_head else ""
    rc, out, _ = svn(["status", "--xml"], cwd=ws["root"])
    if rc != 0:
        return None, 0, None
    return hashlib.sha1(out).hexdigest(), len(parse_status(out)), svn_revision(ws["root"])


def svn_revision(root):
    """工作副本记着的版本号；查不到就返回 None，别把一次失败当成版本变了。"""
    try:
        rc, out, _ = svn(["info", "--xml"], cwd=root)
        if rc != 0:
            return None
        entry = xml_of(out).find("entry")
    except ApiError:
        return None
    return entry.get("revision", "") if entry is not None else None


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

# 路由表：路径 → 处理函数，处理函数收（handler, method, query, body）。
# 只读接口任何方法都回；settings 与 operations 的读法只认 GET，其余方法交给写表。
_NOT_HANDLED = object()


def _add_workspace(handler, body):
    root = str(body.get("root", "")).strip()
    if not root:
        raise ApiError(400, "没给目录")
    item = handler.store.add(root)
    return {"ok": True, "workspace": item}


def _forget_workspace(handler, body):
    wid = str(body.get("ws", ""))
    handler.store.remove(wid)
    if handler.lsp is not None:
        handler.lsp.stop_workspace(wid)
    return {"ok": True}


def _set_alias(handler, body):
    ws = handler.store.find(str(body.get("ws", "")))
    if ws is None:
        raise ApiError(404, "没有这个工作区")
    handler.store.set_alias(ws["id"], str(body.get("alias", "")))
    return {"ok": True}


def _save_settings(handler, body):
    if handler.settings is None:
        raise ApiError(404, "设置没有起来")
    handler.settings.set_search_ignore(body.get("search_ignore") or [])
    return handler._settings_payload()


def _save_groups(handler, body):
    if handler.groups is None:
        raise ApiError(404, "分组结构没有起来")
    # 整份替换：页面改完一次就发整张表，服务端只做清洗。
    return {"ok": True, "groups": handler.groups.set(body.get("nodes") or [])}


READ_ROUTES = {
    "state": lambda h, m, q, b: {"workspaces": h.store.workspaces(), "groups": h._group_nodes()},
    "dirs": lambda h, m, q, b: list_dirs((q.get("path") or [""])[0]),
    "changes": lambda h, m, q, b: h._changes(q),
    "diff": lambda h, m, q, b: h._diff(q),
    "log": lambda h, m, q, b: h._log(q),
    "revision": lambda h, m, q, b: h._revision(q),
    "commit": lambda h, m, q, b: h._commit_detail(q),
    "sync-info": lambda h, m, q, b: h._sync_info(q),
    "tree": lambda h, m, q, b: h._tree(q),
    "file": lambda h, m, q, b: h._file(q),
    "search": lambda h, m, q, b: h._search(q),
    "files": lambda h, m, q, b: h._files(q),
    "settings": lambda h, m, q, b: h._settings_payload() if m == "GET" else _NOT_HANDLED,
    "lsp/status": lambda h, m, q, b: h._lsp_status(),
    "download": lambda h, m, q, b: h._download(q, head=(m == "HEAD")),
    "operations": lambda h, m, q, b: h._latest_job(q) if m == "GET" else _NOT_HANDLED,
}

WRITE_ROUTES = {
    "workspaces": lambda h, m, q, b: _add_workspace(h, b),
    "forget": lambda h, m, q, b: _forget_workspace(h, b),
    "alias": lambda h, m, q, b: _set_alias(h, b),
    "lsp/definition": lambda h, m, q, b: h._lsp_definition(b),
    "lsp/query": lambda h, m, q, b: h._lsp_query(b, str(b.get("action") or "definition")),
    "lsp/symbols": lambda h, m, q, b: h._lsp_symbols(b),
    "lsp/diagnostics": lambda h, m, q, b: h._lsp_diagnostics(b),
    "lsp/hover": lambda h, m, q, b: h._lsp_hover(b),
    "lsp/rename": lambda h, m, q, b: h._lsp_rename(b),
    "lsp/rename-apply": lambda h, m, q, b: h._lsp_rename(b, apply=True),
    "settings": lambda h, m, q, b: _save_settings(h, b),
    "groups": lambda h, m, q, b: _save_groups(h, b),
    "save": lambda h, m, q, b: h._save(b),
    "mkdir": lambda h, m, q, b: h._browse_create(b, "dir"),
    "newfile": lambda h, m, q, b: h._browse_create(b, "file"),
    "rename": lambda h, m, q, b: h._browse_rename(b),
    "delete": lambda h, m, q, b: h._browse_delete(b),
    "stage": lambda h, m, q, b: h._stage(b),
    "unstage": lambda h, m, q, b: h._unstage(b),
    "svn-add": lambda h, m, q, b: h._svn_add(b),
    "svn-unadd": lambda h, m, q, b: h._svn_unadd(b),
    "operations": lambda h, m, q, b: h._start_operation(b),
}


class Handler(VcsRoutes, BrowseRoutes, LspRoutes, WebHandler):
    server_version = "dvcsx-web"

    static = None
    store = None
    # 左侧工作副本的分组结构，存在 state.json 旁边。
    groups = None
    # 全局设置（搜索跳过的目录等），同样存在 state.json 旁边。
    settings = None
    # 代码索引的语言服务器管理器；没起来时这两个接口都说不支持。
    lsp = None
    state_stream = None
    metrics_stream = None
    api_prefix = "/__dvcsx/api"
    # 写操作默认只认本机；--allow-write 把它放开给所有能打开页面的人。
    allow_write = False

    def _error_log(self, msg):
        # 这一侧的日志带时间戳，骨架里的默认写法没有。
        log(msg)

    def _group_nodes(self):
        return self.groups.nodes() if self.groups is not None else []

    def _settings_payload(self):
        ignore = (
            self.settings.search_ignore()
            if self.settings is not None
            else list(SEARCH_IGNORE_DEFAULTS)
        )
        return {"search_ignore": ignore, "defaults": list(SEARCH_IGNORE_DEFAULTS)}

    def _stream_routes(self, route, query):
        # SSE 自己写响应头与数据流，不走一次性回 JSON 的路。
        if route == "state/stream":
            self._sse_state()
            return True
        if route == "events":
            self._sse_workspace(query)
            return True
        if route == "metrics/stream":
            self._sse_metrics()
            return True
        match = re.fullmatch(r"operations/([0-9a-zA-Z_-]+)/events", route)
        if match:
            self._sse_job(match.group(1))
            return True
        return False

    def _dispatch(self, method, route, query, body):
        handler = READ_ROUTES.get(route)
        if handler is not None:
            result = handler(self, method, query, body)
            if result is not _NOT_HANDLED:
                return result
        match = re.fullmatch(r"operations/([0-9a-zA-Z_-]+)", route)
        if match and method == "GET":
            return self._job_json(match.group(1))
        if method != "POST":
            raise ApiError(405, "这个接口只接受 POST")
        handler = WRITE_ROUTES.get(route)
        if handler is not None:
            return handler(self, method, query, body)
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













    def _index_ws(self, body):
        """暂存类接口的公共前置：先挡住别处来的写请求，再找登记的工作区。"""
        self._check_write()
        ws = self.store.find(str(body.get("ws", "")))
        if ws is None:
            raise ApiError(404, "没有这个工作区")
        return ws

    def _index_lock(self, ws):
        lock = workspace_lock(ws["id"])
        # 同一个工作副本同时只跑一个写操作，撞上了让用户等前一个跑完。
        if not lock.acquire(blocking=False):
            raise ApiError(409, "这个工作副本正有一个操作在执行")
        return lock









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
    Handler.groups = LayoutStore(Path(args.state).parent / "groups.json")
    Handler.settings = Settings(Path(args.state).parent / "settings.json")
    Handler.lsp = LspManager()
    Handler.api_prefix = args.api
    Handler.allow_write = args.allow_write
    Handler.state_stream = StateStream(
        [args.state, Path(args.state).parent / "groups.json"],
        lambda: {"workspaces": Handler.store.workspaces(), "groups": Handler.groups.nodes()},
    )
    Handler.state_stream.start()
    Handler.metrics_stream = MetricsStream(METRICS)
    Handler.metrics_stream.start()

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
        # 语言服务器是页面按需拉起的子进程，退出时一并收掉。
        if Handler.lsp is not None:
            Handler.lsp.stop_all()
    return 0


def main(argv=None):
    parser = argparse.ArgumentParser(prog="dvcsx-web", description="dvcsx 网页模式的转发进程")
    parser.add_argument("--static", required=True, help="打包好的页面目录")
    parser.add_argument("--state", required=True, help="工作区登记文件")
    parser.add_argument("--api", default="/__dvcsx/api", help="接口前缀")
    parser.add_argument("--host", default="0.0.0.0", help="监听地址，默认所有网卡")
    parser.add_argument("--port", type=int, default=8100, help="监听端口，默认 8100")
    parser.add_argument(
        "--allow-write",
        action="store_true",
        help="允许其他机器发起拉取、推送、切换分支、更新与提交；默认只认本机",
    )
    parser.add_argument("--open", action="store_true", help="起来后打开浏览器")
    return serve(parser.parse_args(argv))


if __name__ == "__main__":
    sys.exit(main())
