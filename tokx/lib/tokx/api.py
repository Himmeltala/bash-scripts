"""把来源里的 provider 解析成实际请求的 API 地址。"""

from __future__ import annotations

import json
import os
import sys
from dataclasses import dataclass, field
from pathlib import Path

# 共用小件在仓库根的 lib/py-shared 下，源码与安装后的相对层级一致。
sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "lib" / "py-shared"))
from fileio import read_json, read_text

CLAUDE_DEFAULT = "https://api.anthropic.com"

# DSH 内置 provider 的默认地址，profile 与 tokx 配置都没写时使用。
DSH_DEFAULTS = {
    "deepseek-official": "https://api.deepseek.com/anthropic",
    "deepseek": "https://api.deepseek.com",
    "anthropic": "https://api.anthropic.com",
    "xiaomi": "https://api.xiaomimimo.com/v1",
}


@dataclass(slots=True)
class ApiBook:
    overrides: dict[str, str] = field(default_factory=dict)
    routes: dict[str, str] = field(default_factory=dict)
    claude: str = CLAUDE_DEFAULT

    @classmethod
    def load(
        cls,
        apis: dict[str, str],
        *,
        claude_dir: Path,
        opencode_dir: Path,
        dsh_profiles: Path,
    ) -> ApiBook:
        routes = dict(DSH_DEFAULTS)
        routes.update(_opencode_routes(opencode_dir))
        routes.update(_dsh_routes(dsh_profiles))
        return cls(
            overrides=dict(apis),
            routes=routes,
            claude=_claude_address(claude_dir),
        )

    def address(self, source: str, provider: str) -> str:
        """查不到时返回空串，表里显示 -，不拿 provider 冒充地址。"""
        if source == "claude":
            return self.overrides.get(provider) or self.claude
        return self.overrides.get(provider) or self.routes.get(provider) or ""


def _claude_address(directory: Path) -> str:
    for name in ("settings.json", "settings.local.json"):
        doc = _load_json(directory / name)
        env = doc.get("env")
        if isinstance(env, dict):
            value = env.get("ANTHROPIC_BASE_URL")
            if isinstance(value, str) and value.strip():
                return value.strip()
    return os.environ.get("ANTHROPIC_BASE_URL") or CLAUDE_DEFAULT


def _opencode_routes(directory: Path) -> dict[str, str]:
    routes: dict[str, str] = {}
    for name in ("opencode.json", "opencode.jsonc"):
        doc = _load_json(directory / name)
        providers = doc.get("provider")
        if not isinstance(providers, dict):
            continue
        for provider, spec in providers.items():
            options = spec.get("options") if isinstance(spec, dict) else None
            base = options.get("baseURL") if isinstance(options, dict) else None
            if isinstance(base, str) and base.strip():
                routes[str(provider)] = base.strip()
    return routes


def _dsh_routes(profiles: Path) -> dict[str, str]:
    routes: dict[str, str] = {}
    if not profiles.is_dir():
        return routes
    for path in sorted(profiles.glob("*/cordis.patch.yml")):
        routes.update(_providers_from_yaml(path))
    return routes


def _providers_from_yaml(path: Path) -> dict[str, str]:
    """只认 providers 下带 baseURL 的条目，够读 profile 补丁，不当作通用 YAML 解析器。"""
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return {}

    routes: dict[str, str] = {}
    providers_indent: int | None = None
    current: str | None = None
    current_indent = 0
    for raw in lines:
        text = raw.strip()
        if not text or text.startswith("#"):
            continue
        indent = len(raw) - len(raw.lstrip())
        if providers_indent is not None and indent <= providers_indent:
            providers_indent = None
            current = None
        if text == "providers:":
            providers_indent = indent
            continue
        if providers_indent is None:
            continue
        if indent == providers_indent + 2 and text.endswith(":"):
            current = _unquote(text[:-1])
            current_indent = indent
        elif current is not None and indent == current_indent + 2 and text.startswith("baseURL:"):
            value = _unquote(text.split(":", 1)[1])
            if value and not value.startswith("!!"):
                routes[current] = value
    return routes


def _unquote(text: str) -> str:
    value = text.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        value = value[1:-1]
    return value.strip()


def _load_json(path: Path) -> dict:
    if not path.is_file():
        return {}
    parsed = read_json(path, default=None)
    if parsed is not None:
        return parsed if isinstance(parsed, dict) else {}
    text = read_text(path, default=None)
    if text is None:
        return {}
    try:
        parsed = json.loads(_strip_jsonc(text))
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _strip_jsonc(text: str) -> str:
    """去掉 JSONC 的注释，字符串里的内容原样保留。"""
    out: list[str] = []
    index = 0
    size = len(text)
    in_string = False
    while index < size:
        char = text[index]
        if in_string:
            out.append(char)
            if char == "\\" and index + 1 < size:
                out.append(text[index + 1])
                index += 2
                continue
            if char == '"':
                in_string = False
            index += 1
            continue
        if char == '"':
            in_string = True
            out.append(char)
            index += 1
            continue
        if char == "/" and index + 1 < size and text[index + 1] == "/":
            while index < size and text[index] != "\n":
                index += 1
            continue
        if char == "/" and index + 1 < size and text[index + 1] == "*":
            index += 2
            while index + 1 < size and not (text[index] == "*" and text[index + 1] == "/"):
                index += 1
            index += 2
            continue
        out.append(char)
        index += 1
    return "".join(out)
