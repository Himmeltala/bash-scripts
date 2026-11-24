"""把来源里的 provider 解析成实际请求的 API 地址。"""

from __future__ import annotations

import json
import os
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

# 共用小件在仓库根的 lib/py-shared 下，源码与安装后的相对层级一致。
sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "lib" / "py-shared" / "commons"))
sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "lib" / "py-shared" / "services"))
from fileio import read_json, read_text

CLAUDE_DEFAULT = "https://api.anthropic.com"

# Claude Code 的托管设置优先级最高；哪个平台有就读哪个。
CLAUDE_MANAGED = (
    Path("/etc/claude-code/managed-settings.json"),
    Path("/Library/Application Support/ClaudeCode/managed-settings.json"),
    Path(r"C:\Program Files\ClaudeCode\managed-settings.json"),
)

# DSH 内置 provider 的默认地址，profile 与 llmx 配置都没写时使用。
DSH_DEFAULTS = {
    "deepseek-official": "https://api.deepseek.com/anthropic",
    "deepseek": "https://api.deepseek.com",
    "anthropic": "https://api.anthropic.com",
    "xiaomi": "https://api.xiaomimimo.com/v1",
}

# opencode 内置 provider 的默认地址：模型来自 models.dev，地址取各自 SDK 的默认端点。
OPENCODE_DEFAULTS = {
    "anthropic": "https://api.anthropic.com/v1",
    "openai": "https://api.openai.com/v1",
    "google": "https://generativelanguage.googleapis.com/v1beta",
    "deepseek": "https://api.deepseek.com",
    "xai": "https://api.x.ai/v1",
    "openrouter": "https://openrouter.ai/api/v1",
    "groq": "https://api.groq.com/openai/v1",
    "mistral": "https://api.mistral.ai/v1",
    "opencode": "https://opencode.ai/inference/openai/v1",
    "xiaomi": "https://api.xiaomimimo.com/v1",
}

# 没定义的环境变量会被 expandvars 原样留下，出现这两种写法就说明地址不可信。
_UNEXPANDED = re.compile(r"\$(?:\{[^}]+\}|[A-Za-z_][A-Za-z0-9_]*)")


@dataclass(slots=True)
class ApiBook:
    overrides: dict[str, str] = field(default_factory=dict)
    claude: str = CLAUDE_DEFAULT
    opencode: dict[str, str] = field(default_factory=dict)
    opencode_custom: dict[str, str] = field(default_factory=dict)
    dsh: dict[str, str] = field(default_factory=dict)
    # 多个 profile 对同一 provider 写了不同地址时记在这里，不拿其中一个去冒充。
    dsh_conflicts: frozenset[str] = frozenset()
    _claude_projects: dict[str, str] = field(default_factory=dict)
    _opencode_projects: dict[str, dict[str, str]] = field(default_factory=dict)
    _warned: set[str] = field(default_factory=set)
    # 同一条记录一轮里会被问好几次地址，项目根只该查一次。
    _cache: dict[tuple[str, str, str], str] = field(default_factory=dict)
    _managed: str | None = None

    @classmethod
    def load(
        cls,
        apis: dict[str, str],
        *,
        claude_dir: Path,
        opencode_dir: Path,
        dsh_profiles: Path,
    ) -> ApiBook:
        dsh, conflicts = _dsh_routes(dsh_profiles)
        return cls(
            overrides=dict(apis),
            claude=_user_claude_address(claude_dir),
            opencode=_config_routes(opencode_dir),
            opencode_custom=_config_routes_file(os.environ.get("OPENCODE_CONFIG")),
            dsh=dsh,
            dsh_conflicts=frozenset(conflicts),
        )

    def address(self, source: str, provider: str, project: str = "") -> str:
        """查不到时返回空串，表里显示 -，不拿 provider 冒充地址。"""
        key = (source, provider, project)
        cached = self._cache.get(key)
        if cached is not None:
            return cached
        if source == "claude":
            found = self.overrides.get(provider) or self._claude_address(project)
        elif source == "opencode":
            found = self.overrides.get(provider) or self._opencode_address(provider, project)
        else:
            found = self.overrides.get(provider) or self._dsh_address(provider)
        self._cache[key] = found
        return found

    def _claude_address(self, project: str) -> str:
        if self._managed is None:
            self._managed = _managed_address()
        if self._managed:
            return self._managed
        root = _project_root(project)
        if root is not None:
            key = str(root)
            if key not in self._claude_projects:
                self._claude_projects[key] = _project_settings(root)
            if self._claude_projects[key]:
                return self._claude_projects[key]
        return self.claude

    def _opencode_address(self, provider: str, project: str) -> str:
        start = _project_start(project)
        if start is not None:
            key = str(start)
            if key not in self._opencode_projects:
                self._opencode_projects[key] = _project_routes(start)
            found = self._opencode_projects[key].get(provider)
            if found:
                return found
        return (
            self.opencode_custom.get(provider)
            or self.opencode.get(provider)
            or OPENCODE_DEFAULTS.get(provider, "")
        )

    def _dsh_address(self, provider: str) -> str:
        if provider in self.dsh_conflicts:
            if provider not in self._warned:
                self._warned.add(provider)
                print(
                    f"llmx: DSH 的 {provider} 在多个 profile 里地址不同，已按未识别处理；"
                    "可在 [apis] 里指定",
                    file=sys.stderr,
                )
            return ""
        return self.dsh.get(provider, "")


def _project_start(project: str) -> Path | None:
    """记录里的工作目录；不是绝对路径或已经不存在时返回 None。"""
    if not project:
        return None
    try:
        start = Path(project).expanduser()
    except (TypeError, ValueError):
        return None
    return start if start.is_absolute() and start.exists() else None


def _project_root(project: str) -> Path | None:
    """工作目录所在的项目根：最近的有 .git 的目录；没有仓库时就是工作目录本身。"""
    start = _project_start(project)
    if start is None:
        return None
    current = start
    while True:
        if (current / ".git").exists():
            return current
        if current.parent == current:
            return start
        current = current.parent


def _project_routes(start: Path) -> dict[str, str]:
    """opencode 的项目配置：先看工作目录，再看最近的仓库根。"""
    routes = _config_routes(start)
    if routes:
        return routes
    root = _project_root(str(start))
    if root is not None and root != start:
        return _config_routes(root)
    return {}


def _user_claude_address(directory: Path) -> str:
    for name in ("settings.json", "settings.local.json"):
        value = _env_base(directory / name)
        if value:
            return value
    return os.environ.get("ANTHROPIC_BASE_URL") or CLAUDE_DEFAULT


def _managed_address() -> str:
    for path in CLAUDE_MANAGED:
        value = _env_base(path)
        if value:
            return value
    return ""


def _project_settings(root: Path) -> str:
    """项目级设置：local 优先于共享。"""
    for name in ("settings.local.json", "settings.json"):
        value = _env_base(root / ".claude" / name)
        if value:
            return value
    return ""


def _env_base(path: Path) -> str:
    doc = _load_json(path)
    env = doc.get("env")
    if isinstance(env, dict):
        value = env.get("ANTHROPIC_BASE_URL")
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _config_routes(directory: Path) -> dict[str, str]:
    routes: dict[str, str] = {}
    for name in ("opencode.json", "opencode.jsonc"):
        routes.update(_routes_from_doc(_load_json(directory / name)))
    return routes


def _config_routes_file(path: str | None) -> dict[str, str]:
    if not path:
        return {}
    return _routes_from_doc(_load_json(Path(path).expanduser()))


def _routes_from_doc(doc: dict) -> dict[str, str]:
    routes: dict[str, str] = {}
    providers = doc.get("provider")
    if not isinstance(providers, dict):
        return routes
    for provider, spec in providers.items():
        options = spec.get("options") if isinstance(spec, dict) else None
        base = options.get("baseURL") if isinstance(options, dict) else None
        if isinstance(base, str) and base.strip():
            routes[str(provider)] = base.strip()
    return routes


def _dsh_routes(profiles: Path) -> tuple[dict[str, str], set[str]]:
    """合并各 profile 的路由；同一 provider 写了不同地址时记成冲突，不进路由表。"""
    routes = dict(DSH_DEFAULTS)
    seen: dict[str, str] = {}
    conflicts: set[str] = set()
    if profiles.is_dir():
        for path in sorted(profiles.glob("*/cordis.patch.yml")):
            for provider, address in _providers_from_yaml(path).items():
                if provider in seen and seen[provider] != address:
                    conflicts.add(provider)
                seen[provider] = address
    for provider, address in seen.items():
        if provider in conflicts:
            routes.pop(provider, None)
        else:
            routes[provider] = address
    return routes, conflicts


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
            value = _expand_env(_unquote(text.split(":", 1)[1]))
            if value and not value.startswith("!!"):
                routes[current] = value
    return routes


def _expand_env(text: str) -> str:
    """展开 ${VAR} 与 $VAR；变量没定义时返回空串，宁可显示 - 也不存一个假地址。"""
    expanded = os.path.expandvars(text)
    return "" if _UNEXPANDED.search(expanded) else expanded


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
