"""语言服务器注册表：每种语言怎么拉起，本机装了没有。"""

import os
import shutil
import subprocess

SERVERS = {
    "shell": {
        "title": "Shell",
        "language": "shellscript",
        "command": ("bash-language-server", "start"),
        "hint": "npm i -g bash-language-server",
        "suffixes": (".sh", ".bash", ".zsh"),
    },
    "python": {
        "title": "Python",
        "language": "python",
        "command": ("pyright-langserver", "--stdio"),
        "hint": "npm i -g pyright",
        "suffixes": (".py", ".pyi"),
    },
    "typescript": {
        "title": "JS / TS",
        "language": "typescript",
        "command": ("typescript-language-server", "--stdio"),
        "hint": "npm i -g typescript typescript-language-server",
        "suffixes": (".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"),
    },
    "vue": {
        "title": "Vue",
        "language": "vue",
        # 不用单独的服务器：带 @vue/typescript-plugin 的 tsserver 直接认得 .vue，
        # 脚本与模板里的定义、引用、重命名都从它那里拿。
        "command": (),
        "hint": "Vue 要 Node、TypeScript 5 与 @vue/typescript-plugin",
        "bridge_only": True,
        "suffixes": (".vue",),
    },
    "java": {
        "title": "Java",
        "language": "java",
        "timeout": 60.0,
        "init_timeout": 90.0,
        "command": ("jdtls",),
        "hint": "装 Eclipse JDT LS，把 jdtls 放进 PATH",
        "suffixes": (".java",),
    },
}


STABLE_BIN = (
    os.path.expanduser("~/.local/bin"),
    os.path.expanduser("~/.local/share/fnm/aliases/default/bin"),
)


_TS_CACHE = {"done": False, "path": ""}


def typescript_lib():
    """找全局 typescript 的 lib 目录：项目里没装依赖时，JS 与 Vue 服务器要靠它。"""
    if _TS_CACHE["done"]:
        return _TS_CACHE["path"]
    _TS_CACHE["done"] = True
    # dvcsx 自己装的一份 TypeScript 5：语言服务器只认带 tsserver.js 的版本，
    # 全局那份可能是 TypeScript 7（原生实现，没有 tsserver.js）。
    candidates = [os.path.expanduser("~/.local/share/dvcsx/ts/node_modules/typescript/lib")]
    try:
        found = subprocess.run(
            ["npm", "root", "-g"],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            timeout=10,
        )
        root = found.stdout.decode("utf-8", "replace").strip()
        if root:
            candidates.append(os.path.join(root, "typescript", "lib"))
    except (OSError, subprocess.SubprocessError):
        pass
    versions = os.path.expanduser("~/.local/share/fnm/node-versions")
    if os.path.isdir(versions):
        for name in sorted(os.listdir(versions)):
            candidates.append(
                os.path.join(versions, name, "installation", "lib", "node_modules", "typescript", "lib")
            )
    for path in candidates:
        if os.path.isfile(os.path.join(path, "tsserver.js")):
            _TS_CACHE["path"] = path
            return path
    return ""


def which_node():
    path = os.environ.get("PATH", "")
    extra = [item for item in STABLE_BIN if os.path.isdir(item)]
    if extra:
        path = os.pathsep.join(extra + [path])
    return shutil.which("node", path=path)


def server_key(path):
    """按扩展名找语言，找不到返回空串。"""
    suffix = os.path.splitext(str(path or ""))[1].lower()
    for key, entry in SERVERS.items():
        if suffix in entry["suffixes"]:
            return key
    return ""


def language_id(key, path):
    suffix = os.path.splitext(str(path or ""))[1].lower()
    if key == "typescript":
        if suffix == ".tsx":
            return "typescriptreact"
        if suffix == ".jsx":
            return "javascriptreact"
        if suffix in (".ts", ".mts", ".cts"):
            return "typescript"
        return "javascript"
    return SERVERS[key]["language"]

