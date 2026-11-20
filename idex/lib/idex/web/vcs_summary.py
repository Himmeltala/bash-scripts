"""变更清单与状态指纹：把 git 与 svn 的结果合成页面要的形状。"""

import hashlib
import shutil

from web import ApiError
from vcs_cli import git, svn

from vcs_query import (
    expand_unversioned,
    git_changes,
    git_head,
    git_info,
    parse_git_status,
    parse_status,
    split_status,
    svn_info,
    svn_revision,
)


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


def workspace_paths(ws):
    """查文件内容用的根：Git 的路径相对仓库根，SVN 相对登记目录。"""
    if ws.get("vcs") == "git":
        return git_info(ws["root"])["top"]
    return ws["root"]

