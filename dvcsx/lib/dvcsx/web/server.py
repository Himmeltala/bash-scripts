#!/usr/bin/env python3
"""dvcsx 网页模式的转发进程：静态页面加 SVN / Git 查询接口，只用标准库。

页面要的东西都由这里现跑 svn 或 git 命令取：工作副本变更、单个文件的差异、
提交日志、某次提交里某个文件的差异，以及直接浏览工作副本的目录与文件内容。
所有查询都是只读的，不动工作副本。
"""

import argparse
import hashlib
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import threading
import time
import webbrowser
import xml.etree.ElementTree as ET
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

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
# 浏览目录时一层最多回这么多项，再多的目录列出来也翻不动。
BROWSE_MAX = 500

CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".eot": "application/vnd.ms-fontobject",
}


def log(msg):
    print(time.strftime("%H:%M:%S"), msg, file=sys.stderr, flush=True)


class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message


# ---- 工作副本登记 ----

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
        # 早先只收 SVN，记录里没有 vcs 字段，按 SVN 认。
        for item in items:
            item.setdefault("vcs", "svn")
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

    def workspaces(self):
        # 早先登记的地址可能是百分号编码的，列出来之前统一还原成原文。
        return [
            {"id": w["id"], "root": w["root"], "vcs": w.get("vcs", "svn"), "url": unquote(w.get("url", ""))}
            for w in self.load()
        ]


# ---- svn 查询 ----

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


def svn_entry_local(entry, prefix, revs, top):
    """这一版里的文件本地都已经是这一版或更新，就算本地已有。"""
    try:
        rev = int(entry["revision"])
    except (TypeError, ValueError):
        return False
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
    # 工作副本根目录本身的 BASE 往往是 r0，直接 svn log 会一条都没有；从 HEAD 往回想。
    rc, out, err = svn(["log", "--xml", "-v", "-l", str(limit), "-r", "HEAD:1"], cwd=root)
    if rc != 0:
        raise ApiError(500, err or "svn log 失败")
    entries = parse_log(out)
    revs = svn_working_revisions(root)
    top = max(revs.values(), default=0)
    info = svn_info(root)
    # svn log 给的路径相对仓库根，工作副本在仓库里的位置要从这两个地址里减出来。
    url_path = urlparse(info["url"]).path.rstrip("/")
    repo_path = urlparse(info["repo_root"]).path.rstrip("/")
    prefix = url_path[len(repo_path):].rstrip("/") if repo_path and url_path.startswith(repo_path) else url_path
    for entry in entries:
        entry["local"] = svn_entry_local(entry, prefix, revs, top)
    return entries


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


def diff_of(root, args):
    rc, out, err = svn(args, cwd=root)
    text = out.decode("utf-8", "replace")
    if rc != 0 and not text:
        raise ApiError(400, err or "svn diff 失败")
    text, truncated = clip(text)
    return {"text": text, "truncated": truncated, "error": err if rc != 0 else ""}


def change_diff(root, rel, rev=None):
    rel = safe_rel(rel)
    target = os.path.join(root, rel)
    if not inside(root, target):
        raise ApiError(400, "路径要在工作副本里：%s" % rel)
    # 相对工作副本根跑，差异里显示的就是工作副本内的相对路径。
    if rev:
        return diff_of(root, ["diff", "-c", str(rev), "--", rel])
    return diff_of(root, ["diff", "--", rel])


def revision_diff(root, rev, repo_path=""):
    if not (rev or "").isdigit():
        raise ApiError(400, "版本号不对：%s" % rev)
    if repo_path:
        # 日志里的路径是仓库内绝对路径，^/ 是 svn 在工作副本里认出仓库根的写法。
        args = ["diff", "-c", rev, "--", "^" + repo_path]
    else:
        args = ["diff", "-c", rev]
    return diff_of(root, args)


# ---- git 查询 ----

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


def git_change_diff(root, rel):
    """未提交的改动：工作区加暂存区对 HEAD，口径跟 SVN 对 BASE 一致。"""
    has_head, _ = git_head(root)
    if has_head:
        args = ["diff", "HEAD", "--", ":/" + rel]
    else:
        # 空仓库还没有 HEAD，暂存区里的算新增。
        args = ["diff", "--cached", "--", ":/" + rel]
    return git_diff_of(root, args)


def git_revision_diff(root, sha, repo_path=""):
    if not re.fullmatch(r"[0-9a-fA-F]{4,40}", sha or ""):
        raise ApiError(400, "提交号不对：%s" % sha)
    # 日志里的路径相对仓库根，:/ 让 git 也按仓库根解释，工作区是子目录时也对得上。
    args = ["show", "--format=", "--no-color", "--find-renames", sha]
    if repo_path:
        args += ["--", ":/" + repo_path.lstrip("/")]
    return git_diff_of(root, args)


LOG_FMT = "%x1e%H%x1f%h%x1f%an%x1f%aI%x1f%s"


def parse_git_log(text):
    """git log --name-status 的输出：每条提交一行 \\x1e 开头、\\x1f 分字段，后面跟路径动作行。"""
    entries = []
    current = None
    for line in text.split("\n"):
        if line.startswith("\x1e"):
            parts = line[1:].split("\x1f")
            current = None
            if len(parts) >= 5:
                sha, short, author, date, subject = parts[:5]
                current = {
                    "revision": sha,
                    "short": short,
                    "author": author,
                    "date": date,
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


def git_remote_sync(root):
    """取日志前先同步一次远端，好让列表带上别人最新的提交。

    只更新 .git 里的远端跟踪分支与对象，不动工作区、暂存区，也不合并。
    远端连不上或超时就照旧列已有的记录，把原因带回页面。
    """
    meta = {"upstream": "", "fetched": False, "error": ""}
    upstream = git_upstream(root)
    if not upstream:
        return meta
    meta["upstream"] = upstream
    remote = upstream.split("/", 1)[0]
    if not remote:
        return meta
    # 没人看着终端，别让 git 停在要密码、要口令的提示上。
    env = dict(os.environ, GIT_TERMINAL_PROMPT="0")
    env.setdefault("GIT_SSH_COMMAND", "ssh -o BatchMode=yes")
    try:
        rc, _, err = git(
            ["fetch", "--quiet", remote], cwd=root, timeout=FETCH_TIMEOUT, env=env
        )
    except ApiError as exc:
        meta["error"] = exc.message
        return meta
    if rc != 0:
        meta["error"] = (err or "git fetch 失败").splitlines()[0]
        return meta
    meta["fetched"] = True
    return meta


def git_log(root, limit, upstream=""):
    has_head, _ = git_head(root)
    if not has_head:
        return []
    # 本地分支与远端跟踪分支一起列：还没拉进本地分支的提交也要看得见。
    revs = ["HEAD"]
    if upstream and git_ref_exists(root, upstream):
        revs.append(upstream)
    # -- . 让登记的是仓库子目录时只列这个子目录的提交，跟 svn log 从子目录跑一致。
    rc, out, err = git(
        [
            "log", "-n", str(limit), "--no-color", "--name-status",
            "--date=iso-strict", "--format=" + LOG_FMT, *revs, "--", ".",
        ],
        cwd=root,
    )
    if rc != 0:
        raise ApiError(500, err or "git log 失败")
    entries = parse_git_log(out.decode("utf-8", "replace"))
    # 标出哪些提交就在当前分支上，哪些还只在远端分支上。
    rc, out, _ = git(["rev-list", "HEAD", "--", "."], cwd=root)
    local = set(out.decode("utf-8", "replace").split()) if rc == 0 else set()
    for entry in entries:
        entry["local"] = entry["revision"] in local
    return entries


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


# ---- HTTP ----


class Handler(BaseHTTPRequestHandler):
    server_version = "dvcsx-web"
    protocol_version = "HTTP/1.1"

    static = None
    store = None
    api_prefix = "/__dvcsx/api"

    def log_message(self, fmt, *args):
        # 访问日志没有用，轮询一多还会把 runner.log 撑长。
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
        self._json(200, result)

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
        if route == "tree":
            return self._tree(query)
        if route == "file":
            return self._file(query)
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
        # 未纳入版本控制的文件没有差异，读整份内容按新增显示。
        if not rev and item == "unversioned":
            text, truncated = clip(read_unversioned(workspace_paths(ws), rel))
            return {"kind": "file", "path": rel, "text": text, "truncated": truncated}
        if ws.get("vcs") == "git":
            result = git_change_diff(ws["root"], rel)
        else:
            result = change_diff(ws["root"], rel, rev)
        result.update({"kind": "diff", "path": rel})
        return result

    def _log(self, query):
        ws = self._ws(query)
        try:
            limit = int((query.get("limit") or [str(LOG_DEFAULT)])[0])
        except ValueError:
            limit = LOG_DEFAULT
        limit = max(1, min(LOG_MAX, limit))
        if ws.get("vcs") == "git":
            remote = git_remote_sync(ws["root"])
            entries = git_log(ws["root"], limit, remote["upstream"])
            return {"workspace": ws, "entries": entries, "remote": remote}
        return {"workspace": ws, "entries": svn_log(ws["root"], limit)}

    def _revision(self, query):
        ws = self._ws(query)
        rev = (query.get("rev") or [""])[0]
        repo_path = (query.get("path") or [""])[0]
        if ws.get("vcs") == "git":
            result = git_revision_diff(ws["root"], rev, repo_path)
        else:
            result = revision_diff(ws["root"], rev, repo_path)
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
            if "." in Path(rel).name or not (self.static / "index.html").is_file():
                self._send(404, b"not found\n", "text/plain", head=head)
                return
            target = self.static / "index.html"
        ctype = CONTENT_TYPES.get(target.suffix.lower(), "application/octet-stream")
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
    if not (shutil.which("svn") or shutil.which("git")):
        log("找不到 svn 与 git 命令，装上其中一个再试")
        return 3

    Handler.static = static
    Handler.store = Workspaces(args.state)
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
    parser.add_argument("--open", action="store_true", help="起来后打开浏览器")
    return serve(parser.parse_args(argv))


if __name__ == "__main__":
    sys.exit(main())
