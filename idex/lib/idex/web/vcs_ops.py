"""写操作的命令拼装：拉取、推送、切分支、提交、更新。"""

import os
import shlex
import subprocess

from web import ApiError
from jobs import OPERATION_TIMEOUT
from vcs_cli import git, svn

from vcs_query import (
    clean_paths,
    git_branch,
    git_head,
    git_op_env,
    git_ref_exists,
    git_remotes,
    git_upstream,
    parse_git_status,
    parse_status,
)


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


COMMIT_MESSAGE_MAX = 8000

