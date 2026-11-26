# @Author: Himmeltala
# @Date: 2026-11-26 09:29:54
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-26 09:29:54
# @FilePath: \idex\src\idex\web\vcs_summary.py
# @Description: 变更清单与状态指纹：把 git 与 svn 的结果合成页面要的形状。

"""变更清单与状态指纹：把 git 与 svn 的结果合成页面要的形状。"""

import hashlib
import os
import shutil

from web import ApiError
from vcs_cli import git, svn

from vcs_query import (
    expand_unversioned,
    git_changes,
    git_head_branch,
    git_info,
    git_prefix,
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


def changes_report(ws):
    """工作副本的指纹、变更数、当前版本与这次变动的路径。

    指纹变了才提醒页面；版本变了说明外面提交或更新过，日志与同步页要重读。
    路径给页面只重读改动所在的那几层目录，不用把展开的目录全列一遍。
    """
    # 普通目录没有版本控制可查：按目录项的名字、大小与修改时间做指纹，浏览页照样能收到变化。
    if ws.get("vcs") == "none":
        signature, count = dir_signature(ws["root"])
        return signature, count, None, []
    if ws.get("vcs") == "git":
        rc, out, _ = git(["status", "--porcelain", "-z", "-uall", "--", "."], cwd=ws["root"])
        if rc != 0:
            return None, 0, None, []
        files, _ = parse_git_status(out, git_prefix(ws["root"]))
        # HEAD 与分支一次取回，省掉一个子进程。
        has_head, head, branch = git_head_branch(ws["root"])
        sig = hashlib.sha1(out)
        sig.update(head.encode("utf-8") if has_head else b"")
        if branch:
            sig.update(branch.encode("utf-8"))
        paths = []
        for item in files:
            if item.get("path"):
                paths.append(item["path"])
            if item.get("orig"):
                paths.append(item["orig"])
        return sig.hexdigest(), len(files), head if has_head else "", paths[:CHANGED_PATHS_MAX]
    rc, out, _ = svn(["status", "--xml"], cwd=ws["root"])
    if rc != 0:
        return None, 0, None, []
    files = parse_status(out)
    paths = [item["path"] for item in files if item.get("path")]
    return hashlib.sha1(out).hexdigest(), len(files), svn_revision(ws["root"]), paths[:CHANGED_PATHS_MAX]


def changes_signature(ws):
    """指纹、变更数与版本；事件推送只用前三项时走这里。"""
    signature, count, revision, _ = changes_report(ws)
    return signature, count, revision


# 一轮推送最多带这么多条改动路径；再多就让页面退回整棵展开树的刷新。
CHANGED_PATHS_MAX = 500


# 普通目录的指纹：递归读每项的路径、大小与修改时间。条目太多时扫到上限就停，
# 免得几万个文件的目录每轮检查都全量走一遍。
DIR_SCAN_MAX = 20000


def dir_signature(root):
    """普通目录当前状态的指纹，返回值与 changes_signature 的计数配套。"""
    sig = hashlib.sha1()
    count = 0
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames.sort()
        try:
            st = os.stat(dirpath)
            rel = os.path.relpath(dirpath, root)
            sig.update(("%s\0%d\n" % (rel, st.st_mtime_ns)).encode("utf-8", "replace"))
        except OSError:
            pass
        for name in sorted(filenames):
            path = os.path.join(dirpath, name)
            try:
                st = os.stat(path)
            except OSError:
                continue
            sig.update(
                ("%s\0%d\0%d\n" % (os.path.relpath(path, root), st.st_size, st.st_mtime_ns))
                .encode("utf-8", "replace")
            )
            count += 1
            if count >= DIR_SCAN_MAX:
                return sig.hexdigest(), count
    return sig.hexdigest(), count


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

