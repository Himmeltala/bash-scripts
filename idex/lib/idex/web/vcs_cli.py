"""跑 git 与 svn 命令的薄封装：超时与找不到命令都翻成接口错误。"""

import subprocess

from web import ApiError

SVN_TIMEOUT = 30
GIT_TIMEOUT = 30


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

