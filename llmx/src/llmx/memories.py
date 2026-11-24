"""Claude Code 项目持久记忆：``~/.claude/projects/<项目>/memory`` 下的 .md 文件。

项目目录名是 Claude Code 按工作目录编码出来的，这里原样展示，不做还原。
只读写这一层目录里的 .md，项目名与文件名都不接受路径分隔符。
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

from .config import Config


class MemoryError(Exception):
    """记忆读写失败，消息直接给页面。"""


def projects_dir(config: Config) -> Path:
    return config.paths.claude / "projects"


def memory_root(config: Config, project: object) -> Path:
    if not isinstance(project, str) or not project or "/" in project or project in (".", ".."):
        raise MemoryError("项目名不对")
    return projects_dir(config) / project / "memory"


def _file_path(config: Config, project: object, name: object) -> Path:
    root = memory_root(config, project)
    if not isinstance(name, str) or not name.endswith(".md") or "/" in name or name in (".", ".."):
        raise MemoryError("记忆文件名要是不带路径的 .md")
    path = root / name
    try:
        path.resolve().relative_to(root.resolve())
    except ValueError as exc:
        raise MemoryError(f"拒绝记忆目录之外的文件 {path}") from exc
    return path


def list_memories(config: Config) -> dict:
    """列出有记忆目录的项目与其中的 .md 文件；没有任何项目就返回空表。"""
    root = projects_dir(config)
    projects = []
    try:
        dirs = sorted(root.iterdir()) if root.is_dir() else []
    except OSError:
        dirs = []
    for project_dir in dirs:
        memory = project_dir / "memory"
        if not memory.is_dir():
            continue
        files = []
        try:
            paths = sorted(memory.glob("*.md"))
        except OSError:
            paths = []
        for path in paths:
            try:
                stat = path.stat()
            except OSError:
                continue
            files.append(
                {
                    "name": path.name,
                    "size": stat.st_size,
                    "updated": datetime.fromtimestamp(stat.st_mtime, config.book.tz).strftime(
                        "%Y-%m-%d %H:%M"
                    ),
                }
            )
        if not files:
            continue
        # MEMORY.md 是索引，排在最前。
        files.sort(key=lambda item: (item["name"] != "MEMORY.md", item["name"]))
        projects.append({"id": project_dir.name, "files": files})
    return {"dir": str(root), "projects": projects}


def read_file(config: Config, project: object, name: object) -> dict:
    path = _file_path(config, project, name)
    try:
        text = path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return {"path": str(path), "exists": False, "text": "", "size": 0}
    except OSError as exc:
        raise MemoryError(f"读 {path} 失败：{exc}") from exc
    return {
        "path": str(path),
        "exists": True,
        "text": text,
        "size": len(text.encode("utf-8")),
    }


def write_file(config: Config, project: object, name: object, text: object) -> dict:
    if not isinstance(text, str):
        raise MemoryError("内容要是文本")
    path = _file_path(config, project, name)
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
    except OSError as exc:
        raise MemoryError(f"写 {path} 失败：{exc}") from exc
    return {"path": str(path), "size": len(text.encode("utf-8"))}
