"""工具链目录的公共小件：扫安装目录、判断存着的目录还能不能用、拼 PATH。"""

import os
from pathlib import Path


def iter_home_dirs(roots, is_home, nested=None):
    """逐个 root 扫一级子目录，产出 (entry, real)；同一个真实目录只给一次。

    nested 给定时优先用 <entry>/<nested> 当安装目录（fnm 把 Node 放在 installation）。
    符号链接、点开头的目录，以及不满足 is_home 的目录都跳过。
    """
    seen = set()
    for root in roots:
        try:
            entries = sorted(Path(root).iterdir(), key=lambda p: p.name)
        except OSError:
            continue
        for entry in entries:
            if entry.name.startswith(".") or entry.is_symlink():
                continue
            try:
                if not entry.is_dir():
                    continue
            except OSError:
                continue
            home = entry
            if nested is not None:
                candidate = entry / nested
                if candidate.is_dir():
                    home = candidate
            try:
                real = home.resolve()
            except OSError:
                continue
            if real in seen or not is_home(real):
                continue
            seen.add(real)
            yield entry, real


def effective_home(value, is_home):
    """存着的目录还在才用它；没填或已经不在都回退到当前环境（空串）。"""
    return value if value and is_home(value) else ""


def prepend_bin(home, base=None, extra=None):
    """home 非空时把 <home>/bin 放到 PATH 最前，并合并 extra 里的变量；空则返回 None。"""
    if not home:
        return None
    env = dict(os.environ if base is None else base)
    bindir = os.path.join(home, "bin")
    parts = [p for p in env.get("PATH", "").split(os.pathsep) if p and p != bindir]
    env["PATH"] = os.pathsep.join([bindir] + parts)
    if extra:
        env.update(extra)
    return env
