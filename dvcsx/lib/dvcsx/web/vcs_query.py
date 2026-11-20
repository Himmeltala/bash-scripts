"""工作副本查询：变更清单、差异、日志、提交详情与暂存标记。"""

import os
import re
import shutil
import subprocess
from pathlib import Path
import xml.etree.ElementTree as ET
from urllib.parse import unquote, urlparse

from web import ApiError
from fileio import PreviewError, read_text_preview, write_text_preserve_newlines

from browse_fs import browse_file, browse_rel, inside  # noqa: F401  inside 由 server_common 再导出
from server_common import MAX_FILE, inside, safe_rel
from vcs_cli import git, svn


FETCH_TIMEOUT = 20


LOG_DEFAULT = 50


LOG_FMT = "%x1e%H%x1f%h%x1f%an%x1f%aI%x1f%P%x1f%s"


LOG_MAX = 200


LOG_SKIP_MAX = 1000


MAX_TEXT = 2 * 1024 * 1024


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


UNVERSIONED_MAX = 200


UNVERSIONED_SKIP = {".svn", ".git", ".hg", "node_modules", "__pycache__", "dist", "build"}


WIDE_LINE = 2000


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


def changes_payload(ws):
    """工作副本的变更清单：Git 附带索引与工作区分组，SVN 按原样给。"""
    if ws.get("vcs") == "git":
        # 分组直接用这次 git status 的结果，不再跑第二遍。
        data = git_changes(ws["root"])
        data["status"] = split_status(data["files"])
        return data
    info = svn_info(ws["root"])
    rc, out, err = svn(["status", "--xml"], cwd=ws["root"])
    if rc != 0:
        raise ApiError(500, err or "svn status 失败")
    files, truncated = expand_unversioned(ws["root"], parse_status(out))
    return {"info": info, "files": files, "truncated": truncated}


def clean_paths(root, paths):
    """接口收到的一批工作副本内相对路径：逐个校验，重复的只留一次。"""
    if not isinstance(paths, (list, tuple)):
        raise ApiError(400, "路径要是一个列表")
    clean = []
    for raw in paths:
        if not isinstance(raw, str):
            raise ApiError(400, "路径要是文本：%s" % raw)
        rel = safe_rel(raw)
        if not inside(root, os.path.join(root, rel)):
            raise ApiError(400, "路径要在工作副本里：%s" % rel)
        if rel not in clean:
            clean.append(rel)
    if not clean:
        raise ApiError(400, "没有选中要处理的路径")
    return clean


def clip(text):
    if len(text) <= MAX_TEXT:
        return text, False
    return text[:MAX_TEXT] + "\n…（差异太长，后面的没有显示）\n", True


def column_item(code):
    """单列状态字母换成页面展示项；未跟踪在索引列记作 ?，这里单独认。"""
    if code == "?":
        return "unversioned"
    return git_item(code + " ")


def diff_of(root, args):
    rc, out, err = svn(args, cwd=root)
    text = out.decode("utf-8", "replace")
    if rc != 0 and not text:
        raise ApiError(400, err or "svn diff 失败")
    text, truncated = clip(text)
    return {"text": text, "truncated": truncated, "wide": is_wide(text), "error": err if rc != 0 else ""}


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


def git_branch(root):
    """当前分支名；游离 HEAD 时 git 给的是 HEAD，原样带回。"""
    rc, out, _ = git(["rev-parse", "--abbrev-ref", "HEAD"], cwd=root)
    name = out.decode("utf-8", "replace").strip()
    return name if rc == 0 else ""


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


def git_change_diff(root, rel, full=False, scope="head"):
    """未提交的改动，scope 决定取哪一段。

    staged 取暂存区对 HEAD，worktree 取工作区对暂存区；head 取工作区加暂存区
    对 HEAD，口径跟 SVN 对 BASE 一致，也是缺省值。
    """
    if scope == "staged":
        args = ["diff", "--cached", "--", ":/" + rel]
    elif scope == "worktree":
        args = ["diff", "--", ":/" + rel]
    else:
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


def git_changes(root):
    info = git_info(root)
    rc, out, err = git(["status", "--porcelain", "-z", "-uall", "--", "."], cwd=root)
    if rc != 0:
        raise ApiError(500, err or "git status 失败")
    files, truncated = parse_git_status(out)
    return {"info": info, "files": files, "truncated": truncated}


def git_commit_detail(root, sha):
    """一次提交的完整说明、父提交与改动路径；日志列表里只放得下第一行。"""
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
    # 路径只在这一条上算，列表里不带 --name-status，省掉每条提交的树比对与改名配对。
    names_rc, names, _ = git(
        ["show", "--no-color", "--name-status", "-z", "--format=", sha], cwd=root
    )
    return {
        "revision": full.strip(),
        "short": short.strip(),
        "author": author.strip(),
        "email": email.strip(),
        "date": date.strip(),
        "parents": parents.split(),
        "refs": [item.strip() for item in refs.split(",") if item.strip()],
        "message": body.strip("\n"),
        "paths": parse_name_status(names.decode("utf-8", "replace")) if names_rc == 0 else [],
    }


def git_diff_of(root, args):
    rc, out, err = git(args, cwd=root)
    text = out.decode("utf-8", "replace")
    if rc != 0 and not text:
        raise ApiError(400, err or "git diff 失败")
    text, truncated = clip(text)
    return {"text": text, "truncated": truncated, "wide": is_wide(text), "error": err if rc != 0 else ""}


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
    # 不带 --name-status：列表不显示每条提交的文件，带上它每条都要做一次树比对与改名配对，
    # 仓库大时这一项就要一秒多。选中哪条，再由 git_commit_detail 现取那条的路径。
    # -- . 让登记的是仓库子目录时只列这个子目录的提交，跟 svn log 从子目录跑一致。
    rc, out, err = git(
        [
            "log", "-n", str(limit), "--skip=%d" % skip,
            "--no-color", "--topo-order",
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


def git_ref_exists(root, ref):
    rc, _, _ = git(["rev-parse", "--verify", "--quiet", ref + "^{commit}"], cwd=root)
    return rc == 0


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


def git_stage_args(root, paths):
    # -A 连删除与重命名一起收进索引，与页面看到的整条改动一致。
    return ["add", "-A", "--", *clean_paths(root, paths)]


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
        # 分组与冲突直接复用这次 git status 的解析结果，不再跑第二遍。
        "status": split_status(files),
        "conflicts": [item["path"] for item in files if item["item"] == "conflicted"],
    }


def git_unstage_args(root, paths):
    """取消暂存；重命名的原路径也要带上，否则索引里会留下一条删除。"""
    clean = clean_paths(root, paths)
    rc, out, err = git(["status", "--porcelain", "-z", "-uall", "--", "."], cwd=root)
    if rc != 0:
        raise ApiError(500, err or "git status 失败")
    files, _ = parse_git_status(out)
    origins = {item["path"]: item["orig"] for item in files if item.get("orig")}
    wanted = []
    for rel in clean:
        wanted.append(rel)
        if origins.get(rel):
            wanted.append(origins[rel])
    all_paths = clean_paths(root, wanted)
    has_head, _ = git_head(root)
    # 空仓库没有 HEAD，restore 无从取源，只能把条目从索引里删掉。
    if has_head:
        return ["restore", "--staged", "--", *all_paths]
    return ["rm", "-r", "--cached", "--", *all_paths]


def git_upstream(root):
    """当前分支的远端跟踪分支，形如 origin/main；没配远端或游离 HEAD 就为空。"""
    rc, out, _ = git(
        ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], cwd=root
    )
    name = out.decode("utf-8", "replace").strip()
    return name if rc == 0 and name else ""


def is_wide(text):
    """有没有一行超过 WIDE_LINE：压缩产物就是这样，按大文件对待。差异行前的 +/- 标记不算宽度。"""
    for line in text.splitlines():
        width = len(line) - 1 if line[:1] in "+- " else len(line)
        if width > WIDE_LINE:
            return True
    return False


def node_text(parent, name):
    node = parent.find(name) if parent is not None else None
    return (node.text or "").strip() if node is not None and node.text else ""


def parse_git_log(text):
    """git log --format=LOG_FMT 的输出：每条提交一行 \\x1e 开头、\\x1f 分字段。

    路径不在这里取：列表里每条提交都带 --name-status 太慢，页面也只显示选中那一条的
    文件，所以 paths 先留空，选中时由 git_commit_detail 现取。
    """
    entries = []
    for line in text.split("\n"):
        if not line.startswith("\x1e"):
            continue
        parts = line[1:].split("\x1f")
        if len(parts) < 6:
            continue
        sha, short, author, date, parents, subject = parts[:6]
        entries.append(
            {
                "revision": sha,
                "short": short,
                "author": author,
                "date": date,
                # 父提交给页面画时间线用；根提交这里是空表。
                "parents": parents.split(),
                "message": subject,
                "paths": [],
            }
        )
    return entries


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
        index, worktree = code[0], code[1]
        path = raw[3:]
        orig = ""
        if code[0] in "RC":
            # 重命名、复制的原路径紧跟在路径字段后面。
            if i < len(fields):
                orig = fields[i]
            i += 1
        item = git_item(code)
        if item == "unversioned":
            untracked += 1
            # 没被 .gitignore 挡住的依赖目录会有成千上万个文件，列到上限就停。
            if untracked > UNVERSIONED_MAX:
                truncated = True
                continue
        entry = {"path": path, "item": item, "index": index, "worktree": worktree}
        if orig:
            entry["orig"] = orig
        files.append(entry)
    files.sort(key=lambda f: (STATUS_ORDER.get(f["item"], 99), f["path"]))
    return files, truncated


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


def parse_name_status(text):
    """--name-status -z 的输出：动作与路径都用 \\0 分隔，改名与复制是“动作 原路径 新路径”。

    不加 -z 时 git 会把非 ASCII 路径加 C 风格引号，取出来的路径再拿去查差异就成了非法 pathspec。
    """
    fields = text.split("\0")
    paths = []
    i = 0
    while i < len(fields):
        action_field = fields[i]
        i += 1
        # 末尾 NUL 后面是空串；动作列不是单个已知字母的跳过。
        if not action_field:
            continue
        action = action_field[:1]
        if action not in ("A", "C", "D", "M", "R", "T", "U", "X"):
            continue
        path = fields[i] if i < len(fields) else ""
        i += 1
        old_path = ""
        if action in ("R", "C"):
            # 页面点到的是改名后的路径，原路径留着显示“由…改名”。
            old_path, path = path, fields[i] if i < len(fields) else ""
            i += 1
        if path:
            paths.append({"action": action, "kind": "", "path": path, "copyfrom": old_path})
    return paths


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


def split_status(files):
    """按索引列与工作区列把改动分三组，条目复制一份，item 换成本列展示项。"""
    groups = {"staged": [], "unstaged": [], "conflicts": []}
    for entry in files:
        index = entry.get("index", " ")
        worktree = entry.get("worktree", " ")
        if entry.get("item") == "conflicted":
            # 冲突跨两列，展示项仍按整个状态码算，不能只看一列。
            groups["conflicts"].append(dict(entry, item=git_item(index + worktree)))
            continue
        if index in "AMDRCT":
            groups["staged"].append(dict(entry, item=column_item(index)))
        if worktree in "MDT" or index == "?":
            groups["unstaged"].append(dict(entry, item=column_item(worktree)))
    return groups


def svn_add_args(root, paths):
    # --parents 让新加的目录连同上级一起纳管，省得页面逐层选。
    return ["add", "--parents", "--", *clean_paths(root, paths)]


def svn_add_paths(state, paths):
    """纳入版本控制只接受未纳管的路径；已纳管或本地缺失的先让用户看清楚。"""
    if not paths:
        raise ApiError(400, "没有选中要纳入版本控制的路径")
    clean = []
    for rel in paths:
        if state.get(rel) != "unversioned":
            raise ApiError(400, "只能纳入未纳入版本控制的路径：%s" % rel)
        if rel not in clean:
            clean.append(rel)
    return clean


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


def svn_status_state(root):
    """路径到状态的对照表；未纳管目录按文件展开，与页面列的一致。"""
    rc, out, err = svn(["status", "--xml"], cwd=root)
    if rc != 0:
        raise ApiError(500, err or "svn status 失败")
    files, _ = expand_unversioned(root, parse_status(out))
    return {item["path"]: item["item"] for item in files}


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


def svn_unadd_args(root, paths):
    # 撤回纳入用 svn revert：文件留着，只把待提交的新增标记去掉。
    # 目录必须连子项一起撤，只撤目录本身 svn 会报 E155038。
    return ["revert", "--depth", "infinity", "--", *clean_paths(root, paths)]


def svn_unadd_paths(state, paths):
    """取消纳入只认刚纳入、还没提交的路径；改过或已提交的不在这里撤。"""
    if not paths:
        raise ApiError(400, "没有选中要取消纳入版本控制的路径")
    clean = []
    for rel in paths:
        if state.get(rel) != "added":
            raise ApiError(400, "只能取消还没提交的纳入：%s" % rel)
        if rel not in clean:
            clean.append(rel)
    return clean


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


def workspace_paths(ws):
    """查文件内容用的根：Git 的路径相对仓库根，SVN 相对登记目录。"""
    if ws.get("vcs") == "git":
        return git_info(ws["root"])["top"]
    return ws["root"]


def xml_of(out):
    try:
        return ET.fromstring(out)
    except ET.ParseError as exc:
        raise ApiError(500, "svn 返回的 XML 读不懂：%s" % exc)


def detect_vcs(root):
    """认工作副本：先按 SVN 看，不是再看 Git；都不是就当普通目录收下，只给浏览目录。"""
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
    return "none", {"url": ""}

