# @Author: Himmeltala
# @Date: 2026-11-26 09:29:54
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-26 09:29:54
# @FilePath: \idex\src\idex\web\vcs_hunks.py
# @Description: 统一差异的 hunk 切分：还原单块时按原文比对，不认客户端另编的坐标。

import re


HEADER = re.compile(r"^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@")


def parse_hunks(text):
    """把 git diff 的文本切成 hunk；文件头那几行不算。"""
    hunks = []
    current = None
    for raw in str(text or "").splitlines():
        match = HEADER.match(raw)
        if match:
            if current is not None:
                hunks.append(current)
            current = {
                "header": raw,
                "old_start": int(match.group(1)),
                "old_lines": int(match.group(2) or 1),
                "new_start": int(match.group(3)),
                "new_lines": int(match.group(4) or 1),
                "lines": [],
            }
            continue
        if current is None:
            continue
        if raw.startswith((" ", "+", "-", "\\")):
            current["lines"].append(raw)
            continue
        # 文件头、二进制提示这些一出现就说明这一段结束了。
        hunks.append(current)
        current = None
    if current is not None:
        hunks.append(current)
    for hunk in hunks:
        hunk["text"] = "\n".join([hunk["header"], *hunk["lines"]])
    return hunks


def find_hunk(text, raw):
    """在差异里找与原文一字不差的 hunk；找不到返回 None。"""
    wanted = str(raw or "").strip()
    if not wanted:
        return None
    for hunk in parse_hunks(text):
        if hunk["text"].strip() == wanted:
            return hunk
    return None


def reverse_patch(rel, hunk):
    """拼一条只含这个 hunk 的反向补丁，交给 git apply -R。"""
    return "--- a/%s\n+++ b/%s\n%s\n" % (rel, rel, hunk["text"])
