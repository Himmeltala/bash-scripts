"""路径校验：相对路径不许跳出根目录，静态文件也不许顺着 ../ 跑出去。"""

from pathlib import Path


class PathError(ValueError):
    """路径为空、是绝对路径或者要跳出根目录。"""


def within(path, root):
    """path 解析成真实路径后是不是仍在 root 底下；符号链接按指向的位置算。"""
    try:
        Path(path).resolve().relative_to(Path(root).resolve())
        return True
    except (ValueError, OSError, RuntimeError):
        return False


def safe_relative(rel, what="路径"):
    """接口里收到的相对路径：不许空、不许绝对路径、不许用 .. 跳出去。"""
    rel = (rel or "").strip()
    if not rel:
        raise PathError("没给%s" % what)
    if Path(rel).is_absolute() or any(part == ".." for part in Path(rel).parts):
        raise PathError("%s要在根目录里：%s" % (what, rel))
    return rel


def resolve_under(root, rel, what="路径"):
    """把相对路径接到 root 底下并解析成真实路径；越界时抛 PathError。"""
    rel = safe_relative(rel, what)
    root = Path(root).resolve()
    try:
        target = (root / rel).resolve()
        target.relative_to(root)
    except (ValueError, OSError, RuntimeError):
        raise PathError("%s要在根目录里：%s" % (what, rel))
    return target


def static_target(static, url_path, index="index.html"):
    """静态文件请求对应的真实路径；越界或解析不了时返回 None。目录补 index。"""
    static = Path(static).resolve()
    rel = (url_path or "").lstrip("/") or index
    try:
        target = (static / rel).resolve()
        target.relative_to(static)
    except (ValueError, OSError, RuntimeError):
        return None
    if target.is_dir():
        target = target / index
    return target
