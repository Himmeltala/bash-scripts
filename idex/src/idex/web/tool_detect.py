# @Author: Himmeltala
# @Date: 2026-11-26 09:29:54
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-26 09:29:54
# @FilePath: \idex\src\idex\web\tool_detect.py
# @Description: 工具能力探测：从选中的目录找 Node 与 JVM 工程根。

"""工具能力探测：从选中的目录找 Node 与 JVM 工程根。

只读探测，退出码非零、超时、解析失败都只省略对应的一项，不向调用方抛异常。
"""

import hashlib
import os
import subprocess
import sys
from pathlib import Path

# server.py 直接执行时 sys.path 只到 web 目录，补上上一级才能导入 engines。
try:
    from engines.jvm.store import detect_project
except ImportError:  # pragma: no cover - 正常运行由启动脚本保证路径
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from engines.jvm.store import detect_project

# Node 引擎的只读探测入口，与 JVM 共用同一份工程判定。
NODE_ENGINE = str(Path(__file__).resolve().parents[1] / "engines/node/engine.sh")


def tool_id(root):
    """工具项的 id 取工程根的短哈希，与 JVM 登记表、Node 网页的算法一致。"""
    return hashlib.md5(str(root).encode("utf-8")).hexdigest()[:12]


def _detect_node(root, engine, timeout):
    try:
        done = subprocess.run(
            ["bash", engine, "--detect", root],
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if done.returncode != 0:
        return None
    found = done.stdout.strip()
    if not found:
        return None
    return {"root": found, "id": tool_id(found)}


def _detect_jvm(root):
    try:
        found, kind = detect_project(root)
    except Exception:
        return None
    if not found or not kind:
        return None
    return {"root": str(found), "kind": str(kind), "id": tool_id(found)}


def detect_tools(root, node_engine=None, timeout=10.0):
    """探测一个目录下可用的工具，返回 node 与 jvm 的能力；都没有时是空字典。"""
    # Node 探测脚本不认 ~，这里先展开成绝对路径，与 JVM 侧的展开一致。
    root = os.path.abspath(os.path.expanduser(str(root)))
    tools = {}
    node = _detect_node(root, node_engine or NODE_ENGINE, timeout)
    if node:
        tools["node"] = node
    jvm = _detect_jvm(root)
    if jvm:
        tools["jvm"] = jvm
    return tools
