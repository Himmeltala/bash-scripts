# @Author: Himmeltala
# @Date: 2026-11-26 09:29:54
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-26 09:29:54
# @FilePath: \idex\src\idex\web\git_query.py
# @Description: Git 的查询：状态、差异、日志、提交详情与同步信息。

from web import ApiError
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor

from vcs_cli import git

from vcs_common import (
    FETCH_TIMEOUT,
    LOG_FMT,
    MAX_TEXT,
    STATUS_ORDER,
    UNVERSIONED_MAX,
    clean_paths,
    clip,
    is_wide,
)


# 仓库根、相对前缀与 remote URL 登记后基本不变；短时缓存省掉每个请求一次子进程。
_INFO_TTL = 60
_info_cache = {}
_prefix_cache = {}


def _cache_get(cache, key):
    hit = cache.get(key)
    if hit is None:
        return None
    at, value = hit
    if time.time() - at > _INFO_TTL:
        cache.pop(key, None)
        return None
    return value


def _cache_put(cache, key, value):
    cache[key] = (time.time(), value)


def git_prefix(root):
    """工作区在仓库里的路径前缀；根就是仓库时为空串。"""
    cached = _cache_get(_prefix_cache, str(root))
    if cached is not None:
        return cached
    rc, out, _ = git(["rev-parse", "--show-prefix"], cwd=root)
    prefix = out.decode("utf-8", "replace").strip() if rc == 0 else ""
    if rc == 0:
        _cache_put(_prefix_cache, str(root), prefix)
    return prefix


def strip_prefix(path, prefix):
    return path[len(prefix):] if prefix and path.startswith(prefix) else path


def column_item(code):
    """单列状态字母换成页面展示项；未跟踪在索引列记作 ?，这里单独认。"""
    if code == "?":
        return "unversioned"
    return git_item(code + " ")


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
    """未提交的改动，scope 取 staged / worktree / head；head 口径与 SVN 对 BASE 一致，也是缺省值。"""
    # rel 相对工作区根；命令的 cwd 就是工作区，别用仓库根相对的 :/。
    if scope == "staged":
        args = ["diff", "--cached", "--", ":(literal)" + rel]
    elif scope == "worktree":
        args = ["diff", "--", ":(literal)" + rel]
    else:
        has_head, _ = git_head(root)
        if has_head:
            args = ["diff", "HEAD", "--", ":(literal)" + rel]
        else:
            # 空仓库还没有 HEAD，暂存区里的算新增。
            args = ["diff", "--cached", "--", ":(literal)" + rel]
    if full:
        # 整文件模式：上下文给得足够大，diff 里就是整份文件加改动标记。
        args.insert(1, "--unified=1000000")
    return git_diff_of(root, args)


def clip_original(text):
    """原始版本按文件内容的提示截断，不沿用差异文案。"""
    if len(text) <= MAX_TEXT:
        return text, False
    return text[:MAX_TEXT] + "\n…（文件太长，后面的没有显示）\n", True


def git_original(root, rel, scope="worktree", rev=None):
    """差异编辑器左栏的原始版本；未跟踪返回空文本，已跟踪却取不到时明确报错，不能把空文本当成整份新增。"""
    if rev:
        if rev.startswith("-") or not re.fullmatch(r"[0-9A-Za-z._/@^~-]+", rev):
            raise ApiError(400, "版本号不对：%s" % rev)
        # 日志里的路径相对仓库根，工作区的相对路径也能用；两种都试一次。
        specs = ["%s:./%s" % (rev, rel), "%s:%s" % (rev, rel)]
    elif scope in ("staged", "head"):
        specs = ["HEAD:./%s" % rel]
    else:
        specs = [":./%s" % rel]
    rc, out, err = 1, b"", ""
    for spec in specs:
        rc, out, err = git(["show", "--no-textconv", spec], cwd=root)
        if rc == 0:
            break
    if rc != 0:
        if not rev and scope not in ("staged", "head"):
            rc, _, _ = git(["ls-files", "--error-unmatch", "--", rel], cwd=root)
            if rc != 0:
                return {"text": "", "truncated": False}
        raise ApiError(400, err or "取原始版本失败")
    text = out.decode("utf-8", "replace").replace("\r\n", "\n").replace("\r", "\n")
    text, truncated = clip_original(text)
    return {"text": text, "truncated": truncated}


def git_changes(root):
    info = git_info(root)
    rc, out, err = git(["status", "--porcelain", "-z", "-uall", "--", "."], cwd=root)
    if rc != 0:
        raise ApiError(500, err or "git status 失败")
    files, truncated = parse_git_status(out, git_prefix(root))
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
        "paths": parse_name_status(names.decode("utf-8", "replace"), git_prefix(root)) if names_rc == 0 else [],
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


def git_head_branch(root):
    """HEAD 提交号与当前分支一次取回，省一次子进程；空仓库返回 (False, '', '')。"""
    rc, out, _ = git(["rev-parse", "HEAD", "--abbrev-ref", "HEAD"], cwd=root)
    parts = out.decode("utf-8", "replace").split() if rc == 0 else []
    head = parts[0] if parts else ""
    branch = parts[1] if len(parts) > 1 else ""
    return bool(head), head, branch


def git_info(root):
    key = str(root)
    cached = _cache_get(_info_cache, key)
    if cached is not None:
        top, remote = cached
    else:
        rc, out, err = git(["rev-parse", "--show-toplevel"], cwd=root)
        if rc != 0:
            raise ApiError(400, "这个目录不是 Git 仓库：%s" % (err or root))
        top = out.decode("utf-8", "replace").strip()
        rc, remote_out, _ = git(["remote", "get-url", "origin"], cwd=root)
        remote = remote_out.decode("utf-8", "replace").strip() if rc == 0 else ""
        _cache_put(_info_cache, key, (top, remote))
    has_head, head, branch = git_head_branch(root)
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
    # 上游尖端一次取回，同时用来判断上游是否存在，省掉单独一次 rev-parse。
    tip = ""
    if upstream:
        rc, out, _ = git(["rev-parse", "--verify", "--quiet", upstream + "^{commit}"], cwd=root)
        if rc == 0:
            tip = out.decode("utf-8", "replace").strip()
    tracking = bool(tip)
    if all_refs:
        # --branches/--remotes/--tags 代替 HEAD 一个引用，时间线才看得到分叉与合并。
        revs = ["HEAD", "--branches", "--remotes", "--tags"]
    else:
        revs = ["HEAD", upstream] if tracking else ["HEAD"]
    # --topo-order 保证子提交在前，列表顺序能直接画连线；不带 --name-status，大仓库每条树比对要一秒多，路径等选中再取。
    # -- . 让仓库子目录工作区只列本目录提交，与 svn log 从子目录跑一致。
    log_args = [
        "log", "-n", str(limit), "--skip=%d" % skip,
        # --parents 让 git 按路径过滤改写父提交；只用 %P 拿到的是原始父提交，
        # 工作区是仓库子目录时父提交可能已被省掉，时间线会等一个永远不出现的提交。
        "--parents", "--no-color", "--topo-order",
        # 路径过滤默认会把没改这个目录的合并提交省掉，时间线就断开了；--full-history 留住它们。
        "--full-history",
        "--date=iso-strict", "--format=" + LOG_FMT, *revs, "--", ".",
    ]
    # 这几条互不相干，各跑各的 git 进程：大仓库里 rev-list 比 log 还慢，串行就是白等。
    local_revs = ["HEAD", "--branches"] if all_refs else ["HEAD"]
    # 与上面的 log 一样带 --full-history：默认的路径简化会省掉与某一父提交相同的合并提交，
    # 列表里有而这里没有，就会把已经拉下来的合并提交误标成「待拉取」。
    local_args = ["rev-list", "--full-history", *local_revs, "--", "."]
    pushed_revs = None
    if tracking and not all_refs:
        pushed_revs = [upstream]
    elif all_refs:
        # 有没有配远端要看引用表或 remote 才知道，先按 --remotes 跑着；没有远端时这条几乎不花时间。
        pushed_revs = ["--remotes"]
    with ThreadPoolExecutor(max_workers=4) as pool:
        log_future = pool.submit(git, log_args, cwd=root)
        local_future = pool.submit(git, local_args, cwd=root)
        labels_future = pool.submit(git_ref_labels, root)
        pushed_future = (
            pool.submit(git, ["rev-list", "--full-history", *pushed_revs, "--", "."], cwd=root)
            if pushed_revs
            else None
        )
        rc, out, err = log_future.result()
        if rc != 0:
            raise ApiError(500, err or "git log 失败")
        entries = parse_git_log(out.decode("utf-8", "replace"))
        rc, out, _ = local_future.result()
        local = set(out.decode("utf-8", "replace").split()) if rc == 0 else set()
        labels, has_remote = labels_future.result()
        # 引用表里没有远端分支时，还可能只是配了远端但从没抓过；这时才多问一次 remote。
        if not has_remote:
            has_remote = bool(git_remotes(root))
        pushed = set()
        # 全部引用时按“在任意远端跟踪分支上”算，单查当前上游会把别的远端分支误标成未推送；
        # 仓库根本没有远端时不标，免得每条都写“未推送”。
        if pushed_future is not None and (tracking or (all_refs and has_remote)):
            rc, out, _ = pushed_future.result()
            pushed = set(out.decode("utf-8", "replace").split()) if rc == 0 else set()
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
    """提交号到分支/标签的对应，并说明仓库有没有远端；附注标签要取 *objectname 指向的提交。"""
    fmt = "%(objectname)%09%(*objectname)%09%(refname:short)%09%(refname)"
    rc, out, _ = git(
        ["for-each-ref", "--format=" + fmt, "refs/heads", "refs/remotes", "refs/tags"],
        cwd=root,
    )
    labels = {}
    if rc != 0:
        return labels, False
    has_remote = False
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
            has_remote = True
        labels.setdefault(peeled, []).append({"name": short, "kind": kind})
    return labels, has_remote


def git_remote_sync(root, fetch=True):
    """取日志前同步远端，只更新远端跟踪分支与对象，不动工作区、暂存区；失败照旧列已有记录并带回原因。"""
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
        # 提交详情里的路径已按工作区前缀裁过，直接按当前目录解释。
        args += ["--", ":(literal)" + repo_path.lstrip("/")]
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
    files, truncated = parse_git_status(out, git_prefix(root)) if rc == 0 else ([], False)
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
    files, _ = parse_git_status(out, git_prefix(root))
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


def parse_git_log(text):
    """git log --format=LOG_FMT 的输出：每条一行、\\x1e 开头、\\x1f 分字段；路径留空，选中时由 git_commit_detail 现取。"""
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


def parse_git_status(out, prefix=""):
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
        path = strip_prefix(raw[3:], prefix)
        orig = ""
        if code[0] in "RC":
            # 重命名、复制的原路径紧跟在路径字段后面。
            if i < len(fields):
                orig = strip_prefix(fields[i], prefix)
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


def parse_name_status(text, prefix=""):
    """--name-status -z 的输出，动作与路径用 \\0 分隔；不加 -z 时非 ASCII 路径会被 C 风格引号包住，拿去查差异会成非法 pathspec。"""
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
        path = strip_prefix(fields[i] if i < len(fields) else "", prefix)
        i += 1
        old_path = ""
        if action in ("R", "C"):
            # 页面点到的是改名后的路径，原路径留着显示“由…改名”。
            old_path, path = path, fields[i] if i < len(fields) else ""
            i += 1
        if path:
            paths.append({"action": action, "kind": "", "path": path, "copyfrom": old_path})
    return paths


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

