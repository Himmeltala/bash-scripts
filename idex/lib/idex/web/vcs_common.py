"""VCS 查询共用的常量与小工具：文本截断、差异片段、非纳管文件展开。"""
import os

from web import ApiError
from server_common import inside, safe_rel


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


def is_wide(text):
    """有没有一行超过 WIDE_LINE：压缩产物就是这样，按大文件对待。差异行前的 +/- 标记不算宽度。"""
    for line in text.splitlines():
        width = len(line) - 1 if line[:1] in "+- " else len(line)
        if width > WIDE_LINE:
            return True
    return False


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

