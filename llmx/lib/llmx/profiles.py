"""Claude Code 的配置档与用户 CLAUDE.md。

配置档是一份完整的 settings.json，按整份文档存取；应用时先备份现有 settings.json，
再整份覆盖。这里只管文件与校验，HTTP 由网页层接。读取内容可能带 API 密钥，
调用方要自己决定给谁看。
"""

from __future__ import annotations

import difflib
import json
import os
import shutil
import sys
import threading
import time
from contextlib import suppress
from pathlib import Path

# 共用小件在仓库根的 lib/py-shared 下，源码与安装后的相对层级一致。
sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "lib" / "py-shared" / "commons"))
sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "lib" / "py-shared" / "services"))
import fileio

from .config import Paths

# 备份保留份数，超过后按时间从旧往新删。
BACKUP_KEEP = 20
NAME_MAX = 64
_BAD_CHARS = set('/\\:*?"<>|')
# 激活档标记与实际配置的检查间隔。
SYNC_INTERVAL = 5.0
_SYNC_LOCK = threading.Lock()
_SYNC_STARTED = set()


class ProfileError(Exception):
    """配置档读写与校验失败，消息直接给页面。"""


def settings_path(paths: Paths) -> Path:
    return paths.claude / "settings.json"


def memory_path(paths: Paths) -> Path:
    return paths.claude / "CLAUDE.md"


def profile_dir(paths: Paths) -> Path:
    return paths.profiles / "claude"


def backup_dir(paths: Paths) -> Path:
    return paths.backups / "claude"


def _check_name(name: object) -> str:
    """名称就是文件名主干：允许中文，不许路径分隔符与首尾点空格。"""
    if not isinstance(name, str):
        raise ProfileError("配置名要是文本")
    if not name:
        raise ProfileError("配置名不能为空")
    if len(name) > NAME_MAX:
        raise ProfileError(f"配置名最多 {NAME_MAX} 个字符")
    if name != name.strip():
        raise ProfileError("配置名首尾不能有空格")
    if name.startswith(".") or name.endswith("."):
        raise ProfileError("配置名不能以点开头或结尾")
    for char in name:
        if char in _BAD_CHARS:
            raise ProfileError(f"配置名不能包含 {char}")
        if ord(char) < 32:
            raise ProfileError("配置名不能包含控制字符")
    return name


def _profile_file(paths: Paths, name: object) -> Path:
    return profile_dir(paths) / f"{_check_name(name)}.json"


def _active_file(paths: Paths) -> Path:
    """记住哪个配置档在跟着实际 settings.json 走；点都不开头，不会被当成配置档。"""
    return profile_dir(paths) / ".active"


def active_name(paths: Paths) -> str:
    try:
        name = _active_file(paths).read_text(encoding="utf-8").strip()
    except (OSError, UnicodeDecodeError):
        return ""
    if not name:
        return ""
    try:
        return name if _profile_file(paths, name).is_file() else ""
    except ProfileError:
        return ""


def _set_active(paths: Paths, name: str) -> None:
    _ensure_dir(profile_dir(paths))
    try:
        _active_file(paths).write_text(name, encoding="utf-8")
    except OSError:
        pass


def _clear_active(paths: Paths) -> None:
    with suppress(OSError):
        _active_file(paths).unlink()


def _ensure_dir(path: Path) -> None:
    try:
        path.mkdir(parents=True, exist_ok=True)
        os.chmod(path, 0o700)
    except OSError as exc:
        raise ProfileError(f"建不了目录 {path}: {exc}") from exc


def _read(path: Path, what: str) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except OSError as exc:
        raise ProfileError(f"读不了{what} {path}: {exc}") from exc
    except UnicodeDecodeError as exc:
        raise ProfileError(f"{what} {path} 不是 UTF-8，网页里改不了") from exc


def _write(path: Path, text: str, mode: int = 0o600) -> int:
    """原子替换；已有文件沿用原权限，新建时用 mode。"""
    keep = None
    with suppress(OSError):
        keep = path.stat().st_mode & 0o777
    try:
        fileio.atomic_write_text(path, text)
        os.chmod(path, keep if keep is not None else mode)
    except OSError as exc:
        raise ProfileError(f"写不了 {path}: {exc}") from exc
    return len(text.encode("utf-8"))


def check_settings(text: object) -> None:
    """settings 必须是合法 JSON 对象；写坏的配置会让 Claude Code 读不进去。"""
    if not isinstance(text, str):
        raise ProfileError("配置内容要是文本")
    try:
        doc = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ProfileError(
            f"不是合法 JSON：{exc.msg}（第 {exc.lineno} 行第 {exc.colno} 列）"
        ) from exc
    if not isinstance(doc, dict):
        raise ProfileError("settings.json 顶层要是一个对象")


def _normal(text: str) -> str:
    """比对生效状态时只忽略换行风格与末尾空行，不算改内容。"""
    return text.replace("\r\n", "\n").rstrip("\n")


def _size(text: str) -> int:
    return len(text.encode("utf-8"))


def _stamp(now: float | None = None) -> str:
    return time.strftime("%Y%m%d-%H%M%S", time.localtime(now))


def _iso(seconds: float) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(seconds))


def list_profiles(paths: Paths) -> dict:
    directory = profile_dir(paths)
    target = settings_path(paths)
    active = active_name(paths)
    target_text = ""
    if target.is_file():
        with suppress(OSError, UnicodeDecodeError):
            target_text = _normal(target.read_text(encoding="utf-8"))

    profiles = []
    try:
        files = sorted(directory.glob("*.json"))
    except OSError:
        files = []
    for path in files:
        try:
            stat = path.stat()
            text = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        profiles.append(
            {
                "name": path.stem,
                "size": stat.st_size,
                "updated": _iso(stat.st_mtime),
                "applied": bool(target_text) and _normal(text) == target_text,
                "active": path.stem == active,
            }
        )
    profiles.sort(key=lambda item: (item["updated"], item["name"]), reverse=True)
    return {
        "dir": str(directory),
        "target": {"path": str(target), "exists": target.is_file()},
        "active": active,
        "profiles": profiles,
    }


def read_profile(paths: Paths, name: object) -> dict:
    path = _profile_file(paths, name)
    if not path.is_file():
        raise ProfileError(f"没有配置档 {name}")
    text = _read(path, "配置档")
    return {"name": name, "path": str(path), "text": text, "size": _size(text)}


def save_profile(paths: Paths, name: object, text: object) -> dict:
    path = _profile_file(paths, name)
    check_settings(text)
    _ensure_dir(profile_dir(paths))
    return {"name": name, "path": str(path), "size": _write(path, text)}


def create_profile(paths: Paths, name: object, source: str = "blank", origin: object = None) -> dict:
    path = _profile_file(paths, name)
    if path.exists():
        raise ProfileError(f"配置档 {name} 已经存在")
    if source == "blank":
        text = "{}\n"
    elif source == "settings":
        target = settings_path(paths)
        if not target.is_file():
            raise ProfileError(f"还没有 {target}，不能从这里复制")
        text = _read(target, "生效配置")
    elif source == "profile":
        text = read_profile(paths, origin)["text"]
    else:
        raise ProfileError(f"不认识的来源 {source}")
    check_settings(text)
    _ensure_dir(profile_dir(paths))
    _write(path, text)
    return read_profile(paths, name)


def rename_profile(paths: Paths, old: object, new: object) -> dict:
    src = _profile_file(paths, old)
    dst = _profile_file(paths, new)
    if src == dst:
        return {"name": new, "path": str(dst)}
    if not src.is_file():
        raise ProfileError(f"没有配置档 {old}")
    if dst.exists():
        raise ProfileError(f"配置档 {new} 已经存在")
    was_active = active_name(paths) == old
    try:
        src.rename(dst)
    except OSError as exc:
        raise ProfileError(f"改名失败：{exc}") from exc
    if was_active:
        _set_active(paths, str(new))
    return {"name": new, "path": str(dst)}


def delete_profile(paths: Paths, name: object) -> dict:
    path = _profile_file(paths, name)
    if not path.is_file():
        raise ProfileError(f"没有配置档 {name}")
    was_active = active_name(paths) == name
    try:
        path.unlink()
    except OSError as exc:
        raise ProfileError(f"删不掉 {path}: {exc}") from exc
    if was_active:
        _clear_active(paths)
    return {"name": name}


def current_settings(paths: Paths) -> dict:
    path = settings_path(paths)
    if not path.is_file():
        return {"path": str(path), "exists": False, "text": "", "size": 0}
    text = _read(path, "生效配置")
    return {"path": str(path), "exists": True, "text": text, "size": _size(text)}


def _prune_backups(directory: Path) -> None:
    try:
        files = sorted(directory.glob("settings-*.json"))
    except OSError:
        return
    for path in files[:-BACKUP_KEEP] if len(files) > BACKUP_KEEP else []:
        with suppress(OSError):
            path.unlink()


def backup_settings(paths: Paths, target: Path | None = None) -> str:
    source = target or settings_path(paths)
    directory = backup_dir(paths)
    _ensure_dir(directory)
    stamp = _stamp()
    dest = directory / f"settings-{stamp}.json"
    index = 1
    while dest.exists():
        dest = directory / f"settings-{stamp}-{index}.json"
        index += 1
    try:
        shutil.copy2(source, dest)
    except OSError as exc:
        raise ProfileError(f"备份现有配置失败：{exc}") from exc
    _prune_backups(directory)
    return str(dest)


def apply_profile(paths: Paths, name: object) -> dict:
    profile = read_profile(paths, name)
    check_settings(profile["text"])
    target = settings_path(paths)
    backup = None
    if target.is_file():
        backup = backup_settings(paths, target)
    size = _write(target, profile["text"])
    _set_active(paths, str(name))
    return {"name": name, "target": str(target), "backup": backup, "size": size}


def _infer_active(paths: Paths) -> str:
    """没有激活标记时，只有一个配置档与实际配置完全一致就认它。"""
    target = settings_path(paths)
    try:
        current = _normal(target.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError):
        return ""
    matches = []
    for path in profile_dir(paths).glob("*.json"):
        try:
            if _normal(path.read_text(encoding="utf-8")) == current:
                matches.append(path.stem)
        except (OSError, UnicodeDecodeError):
            continue
    return matches[0] if len(matches) == 1 else ""


def sync_active(paths: Paths) -> dict | None:
    """把实际 settings.json 覆盖到激活档；只动这一个配置档，别的配置档不碰。"""
    with _SYNC_LOCK:
        name = active_name(paths)
        if not name:
            name = _infer_active(paths)
            if not name:
                return None
            _set_active(paths, name)
        target = settings_path(paths)
        if not target.is_file():
            return None
        try:
            text = target.read_text(encoding="utf-8")
            check_settings(text)
        except (OSError, UnicodeDecodeError, ProfileError):
            return None
        path = _profile_file(paths, name)
        try:
            old = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            _clear_active(paths)
            return None
        if _normal(old) == _normal(text):
            return None
        try:
            size = _write(path, text)
        except ProfileError:
            return None
        return {"name": name, "size": size}


def start_sync(paths: Paths, interval: float = SYNC_INTERVAL):
    """后台看着实际 settings.json；变了就同步到激活档。同一份目录只起一条线程。"""
    key = str(profile_dir(paths))
    with _SYNC_LOCK:
        if key in _SYNC_STARTED:
            return None
        _SYNC_STARTED.add(key)
    stop = threading.Event()

    def signature():
        try:
            stat = settings_path(paths).stat()
        except OSError:
            return None
        return (stat.st_mtime_ns, stat.st_size)

    def run():
        # 启动时先对一次，界面上看到的激活档立刻跟上实际配置。
        try:
            sync_active(paths)
        except Exception:
            pass
        last = signature()
        while not stop.wait(interval):
            current = signature()
            if current is None or current == last:
                continue
            last = current
            try:
                sync_active(paths)
            except Exception:
                pass

    threading.Thread(target=run, name="llmx-profile-sync", daemon=True).start()
    return stop


def settings_diff(paths: Paths, name: object) -> dict:
    """应用前看一眼：当前生效文件与所选配置档的差异，交给页面的 DiffView。"""
    profile = read_profile(paths, name)
    current = current_settings(paths)
    lines = difflib.unified_diff(
        current["text"].splitlines(keepends=True),
        profile["text"].splitlines(keepends=True),
        fromfile=current["path"],
        tofile=f"{name}.json",
        n=3,
    )
    applied = current["exists"] and _normal(current["text"]) == _normal(profile["text"])
    return {
        "name": name,
        "target": current["path"],
        "exists": current["exists"],
        "applied": applied,
        "text": "".join(lines),
    }


def read_memory(paths: Paths) -> dict:
    path = memory_path(paths)
    if not path.is_file():
        return {"path": str(path), "exists": False, "text": "", "size": 0}
    text = _read(path, "CLAUDE.md")
    return {"path": str(path), "exists": True, "text": text, "size": _size(text)}


def write_memory(paths: Paths, text: object) -> dict:
    if not isinstance(text, str):
        raise ProfileError("内容要是文本")
    path = memory_path(paths)
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        raise ProfileError(f"建不了目录 {path.parent}: {exc}") from exc
    return {"path": str(path), "size": _write(path, text, mode=0o644)}
