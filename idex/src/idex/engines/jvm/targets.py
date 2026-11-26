# @Author: Himmeltala
# @Date: 2026-11-26 09:29:54
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-26 09:29:54
# @FilePath: \idex\src\idex\engines\jvm\targets.py
# @Description: 找 mvnx / gradlex 入口，并在工作区根目录取目标清单。

"""找 mvnx / gradlex 入口，并在工作区根目录取目标清单。

目标是工具自己算出来的：引擎不读 pom，也不读 settings.gradle。
"""

import json
import os
import shutil
import subprocess
from pathlib import Path

# 每个工程类型要列的命令；mvn 的 install 会展开成可选装的子模块。
COMMANDS = {
    "mvn": ("run", "war", "install", "package"),
    "gradle": ("run", "build"),
}
# 大工程扫一次要几秒，留足余量。
SCAN_TIMEOUT = 120


class ScanError(Exception):
    """目标扫描失败；消息原样给页面。"""


def _tool_argv(path):
    """入口可执行就直接起，否则交给 bash，源码检出里忘了 chmod 也能跑。"""
    if os.access(path, os.X_OK):
        return [path]
    return ["bash", path]


def default_tools():
    """优先看仓库里的 mvnx / gradlex，其次看 PATH；环境变量可覆盖，测试用。"""
    base = Path(__file__).resolve().parents[5]
    tools = {}
    for kind, env_name, name in (
        ("mvn", "JVMX_MVNX", "mvnx"),
        ("gradle", "JVMX_GRADLEX", "gradlex"),
    ):
        candidate = os.environ.get(env_name) or str(base / name / "bin" / name)
        if not os.path.isfile(candidate):
            candidate = shutil.which(name) or candidate
        tools[kind] = _tool_argv(candidate)
    return tools


def _scan_command(kind, command, root, argv):
    try:
        done = subprocess.run(
            argv + ["--list", "--json", command],
            cwd=root,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=SCAN_TIMEOUT,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        raise ScanError("跑不起 %s：%s" % (argv[0], exc))
    if done.returncode != 0:
        detail = done.stderr.decode("utf-8", "replace").strip().splitlines()
        raise ScanError(
            "%s --list --json %s 失败：%s"
            % (argv[0], command, detail[-1] if detail else "退出码 %d" % done.returncode)
        )
    try:
        data = json.loads(done.stdout.decode("utf-8", "replace"))
    except ValueError:
        raise ScanError("%s 输出的不是 JSON" % argv[0])
    targets = data.get("targets") if isinstance(data, dict) else None
    if not isinstance(targets, list):
        raise ScanError("%s 没有给出 targets" % argv[0])
    return targets


def scan_workspace(ws, tools=None):
    """列一个工作区的全部目标，合成一张平铺表。

    两次调用之间工程可能变化，所以 rescan 永远重新跑工具，不读缓存。
    """
    kind = ws.get("kind")
    if kind not in COMMANDS:
        raise ScanError("工作区类型不认识：%s" % kind)
    tools = tools or default_tools()
    argv = tools.get(kind)
    if not argv:
        raise ScanError("找不到 %s 对应的工具" % kind)
    root = ws.get("root")
    if not root or not Path(root).is_dir():
        raise ScanError("工作区目录不存在：%s" % root)

    out = []
    for command in COMMANDS[kind]:
        for item in _scan_command(kind, command, root, argv):
            if not isinstance(item, dict):
                continue
            tag = str(item.get("tag") or "").strip()
            if not tag:
                continue
            out.append(
                {
                    "id": str(item.get("id") or "%s:%s" % (command, tag)),
                    "command": command,
                    "tag": tag,
                    "path": str(item.get("path") or ""),
                    "cwd": str(item.get("cwd") or ""),
                    "display": str(item.get("display") or ""),
                }
            )
    return out
