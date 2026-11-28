# @Author: Himmeltala
# @Date: 2026-11-28 09:40:00
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-28 10:20:00
# @FilePath: \idex\src\idex\web\settings_schema.py
# @Description: 设置登记表：每一项的键、类型、默认值、范围与界面元数据，读写与校验都由它派生。

"""加一项设置只改这里；默认值、归一化、载荷与前端控件都由登记表派生。settings.json 存扁平键值：{"version": 2, "values": {...}}。"""

# 搜索默认跳过的目录：依赖、缓存与构建产物，列出来也翻不动。
SEARCH_IGNORE_DEFAULTS = [".git", ".svn", ".hg", "node_modules", "__pycache__", "dist", "build", "target"]
SEARCH_IGNORE_MAX = 50
SEARCH_IGNORE_LEN = 80

# 编辑器配色与代码地图。
EDITOR_THEME_LABELS = (
    ("auto", "跟随界面"),
    ("github-light", "GitHub Light"),
    ("github-dark", "GitHub Dark"),
    ("one-dark", "One Dark"),
    ("dracula", "Dracula"),
)
EDITOR_THEMES = tuple(value for value, _ in EDITOR_THEME_LABELS)

# 快捷键：空串表示停用。
SHORTCUT_DEFAULTS = {
    "save": "Ctrl+S",
    "commit": "Ctrl+Enter",
    "browseSearch": "Ctrl+Shift+E",
    "browseContentSearch": "Ctrl+Shift+F",
    "quickOpen": "Ctrl+P",
    "gotoLine": "Ctrl+G",
    "outline": "Ctrl+Shift+O",
    "problems": "Ctrl+Shift+M",
    "hover": "Ctrl+I",
    "editorFind": "Ctrl+F",
    "complete": "Ctrl+Space",
    "format": "Shift+Alt+F",
    "rename": "F2",
    "terminalToggle": "Ctrl+`",
    "terminalNew": "Ctrl+Shift+`",
    "terminalClose": "Ctrl+Alt+W",
}

# 终端外观：字体空着表示跟随代码字体，字号 0 表示跟随代码字号。
TERMINAL_DEFAULTS = {
    "font_family": (
        "'JetBrains Mono', Roboto, 'Noto Sans SC', 'Source Han Sans SC', "
        "'PingFang SC', 'Microsoft YaHei', sans-serif"
    ),
    "font_size": 14,
    "line_height": 1.15,
    "font_weight": "normal",
    "letter_spacing": 0,
    "cursor_style": "block",
    "cursor_blink": True,
    "scrollback": 5000,
}
TERMINAL_CURSORS = ("block", "bar", "underline")
TERMINAL_WEIGHTS = ("normal", "bold", "500")

# 编辑器字体：与终端分开存，改编辑器不影响终端。
EDITOR_FONT_DEFAULTS = {
    "font_family": (
        "'JetBrains Mono', Roboto, 'Noto Sans SC', 'Source Han Sans SC', "
        "'PingFang SC', 'Microsoft YaHei', sans-serif"
    ),
    "font_size": 14,
    "line_height": 1.6,
    "font_weight": "normal",
    "letter_spacing": 0,
}

# 全局动画方案：预设一套手感，速度再整体缩放。
ANIMATION_PRESETS = ("none", "quick", "standard", "spring", "soft")
ANIMATION_PRESET_LABELS = (
    ("none", "无"),
    ("quick", "快速"),
    ("standard", "标准"),
    ("spring", "弹性"),
    ("soft", "柔和"),
)
ANIMATION_DEFAULTS = {"preset": "standard", "speed": 1}

# 顶栏各块的显示开关：五个指标各自一个，运行服务、最近打开、深浅色各一个。
# runs 只筛顶栏运行服务菜单里的动作类型，默认三类都显示。
HEADER_METRICS = ("cpu", "memory", "disk", "download", "upload")
HEADER_RUN_TYPES = ("start", "package", "install")
HEADER_DEFAULTS = {
    "metrics": {name: True for name in HEADER_METRICS},
    "runs": {name: True for name in HEADER_RUN_TYPES},
    "services": True,
    "recent": True,
    "theme": True,
}

# 指标与动作类型的中文名，界面与设置页共用。
HEADER_METRIC_LABELS = {
    "cpu": "CPU",
    "memory": "内存",
    "disk": "磁盘",
    "download": "下载速度",
    "upload": "上传速度",
}
HEADER_RUN_LABELS = {"start": "启动", "package": "打包", "install": "安装"}

# 语言服务器：关掉的不启动；新增的服务器默认开启，所以存的是关闭名单。
LSP_SERVER_LABELS = (
    ("shell", "Shell"),
    ("python", "Python"),
    ("typescript", "JS / TS"),
    ("vue", "Vue"),
    ("java", "Java"),
)
LSP_SERVER_KEYS = tuple(key for key, _ in LSP_SERVER_LABELS)

WEIGHT_LABELS = (("normal", "常规"), ("500", "中等"), ("bold", "加粗"))
CURSOR_LABELS = (("block", "方块"), ("bar", "竖线"), ("underline", "下划线"))


class Setting:
    """一项设置：默认值与界面元数据从这里读，清洗按 type 与范围做；不用 dataclass，测试加载器按路径建模块会让它反查 sys.modules 失败。"""

    __slots__ = (
        "key", "type", "default", "label", "description", "group", "section", "order",
        "minimum", "maximum", "step", "decimals", "max_length", "max_items",
        "zero_as_default", "choices", "tags", "renderer", "clean", "hidden",
    )

    def __init__(
        self,
        key,
        type,
        default,
        label,
        description="",
        group="",
        section="",
        order=0,
        minimum=None,
        maximum=None,
        step=None,
        decimals=0,
        max_length=0,
        max_items=0,
        zero_as_default=False,
        choices=(),
        tags=(),
        renderer="",
        clean=None,
        hidden=False,
    ):
        self.key = key
        self.type = type
        self.default = default
        self.label = label
        self.description = description
        self.group = group
        self.section = section
        self.order = order
        self.minimum = minimum
        self.maximum = maximum
        self.step = step
        self.decimals = decimals
        self.max_length = max_length
        self.max_items = max_items
        self.zero_as_default = zero_as_default
        self.choices = choices
        self.tags = tags
        self.renderer = renderer
        self.clean = clean
        self.hidden = hidden

    def schema(self):
        """给前端的元数据；None 的字段不出现，省得页面判断。"""
        out = {
            "key": self.key,
            "type": self.type,
            "label": self.label,
            "description": self.description,
            "group": self.group,
            "section": self.section,
            "order": self.order,
            "default": self.default,
        }
        for name in ("minimum", "maximum", "step"):
            value = getattr(self, name)
            if value is not None:
                out[name] = value
        for name in ("decimals", "max_length", "max_items"):
            value = getattr(self, name)
            if value:
                out[name] = value
        if self.choices:
            out["choices"] = [{"value": value, "title": title} for value, title in self.choices]
        if self.tags:
            out["tags"] = list(self.tags)
        if self.renderer:
            out["renderer"] = self.renderer
        if self.hidden:
            out["hidden"] = True
        return out


def _clean_search_ignore(value):
    """只收目录名：去空白、去重，带路径分隔符的条目丢掉，数量与长度都设上限。"""
    names = []
    for item in value if isinstance(value, (list, tuple)) else []:
        name = str(item).strip()
        if not name or name in (".", "..") or "/" in name or "\\" in name:
            continue
        if len(name) > SEARCH_IGNORE_LEN or name in names:
            continue
        names.append(name)
        if len(names) >= SEARCH_IGNORE_MAX:
            break
    return names


def _clean_lsp_disabled(value):
    """只收登记过的服务器名，去重；存的都是关掉的。"""
    out = []
    for item in value if isinstance(value, (list, tuple)) else []:
        key = str(item)
        if key in LSP_SERVER_KEYS and key not in out:
            out.append(key)
    return out


def _clean_shortcuts(value):
    """快捷键按登记表收：未知项丢掉，写坏的值退回默认，空串表示停用。"""
    out = dict(SHORTCUT_DEFAULTS)
    if not isinstance(value, dict):
        return out
    for key in SHORTCUT_DEFAULTS:
        item = value.get(key)
        if not isinstance(item, str):
            continue
        text = " ".join(item.split())
        out[key] = text if len(text) <= 40 else SHORTCUT_DEFAULTS[key]
    return out


def _setting(key, type_, default, label, **kwargs):
    return Setting(key=key, type=type_, default=default, label=label, **kwargs)


SETTINGS = (
    # 搜索
    _setting("search.ignore", "dir_list", list(SEARCH_IGNORE_DEFAULTS), "跳过的目录",
             description="一行一个目录名，按名字匹配任意层级；留空则不跳过。",
             group="搜索", order=10, clean=_clean_search_ignore),
    # 编辑器
    _setting("editor.font_family", "str", EDITOR_FONT_DEFAULTS["font_family"], "字体",
             description="跟 CSS 的 font-family 一样，逗号分隔字体名；只影响编辑器，不影响终端。",
             group="编辑器", section="字体", order=20, max_length=300),
    _setting("editor.font_size", "float", 14, "字号", description="像素值，任意数字。",
             group="编辑器", section="字体", order=21,
             minimum=4, maximum=48, decimals=1, zero_as_default=True),
    _setting("editor.line_height", "float", 1.6, "行高", description="倍数，例如 1.6。",
             group="编辑器", section="字体", order=22,
             minimum=1.0, maximum=3.0, decimals=2, step=0.05),
    _setting("editor.font_weight", "enum", "normal", "字重",
             group="编辑器", section="字体", order=23, choices=WEIGHT_LABELS),
    _setting("editor.letter_spacing", "float", 0, "字间距",
             description="像素，可为负数；中文与符号挤在一起时加一点。",
             group="编辑器", section="字体", order=24,
             minimum=-2, maximum=5, decimals=2, step=0.5),
    _setting("editor.theme", "enum", "auto", "代码配色",
             description="选中即预览，保存后下次打开仍沿用。",
             group="编辑器", section="外观", order=30, choices=EDITOR_THEME_LABELS),
    _setting("editor.minimap", "bool", False, "代码地图",
             description="在编辑器右侧显示当前文件的缩略图，点击可快速跳转。",
             group="编辑器", section="外观", order=31),
    _setting("editor.minimap_opacity", "int", 100, "代码地图背景透明度",
             description="百分比：0 全透明，100 为原来的不透明底色；只在开着代码地图时生效。",
             group="编辑器", section="外观", order=32,
             minimum=0, maximum=100),
    # 终端
    _setting("terminal.font_family", "str", TERMINAL_DEFAULTS["font_family"], "字体",
             description="跟 CSS 的 font-family 一样，逗号分隔字体名；留空用应用默认等宽字体。",
             group="终端", section="字体", order=40, max_length=300),
    _setting("terminal.font_size", "float", 14, "字号", description="像素值，任意数字。",
             group="终端", section="字体", order=41,
             minimum=4, maximum=48, decimals=1, zero_as_default=True),
    _setting("terminal.line_height", "float", 1.15, "行高", description="倍数，例如 1.15。",
             group="终端", section="字体", order=42,
             minimum=0.8, maximum=2.0, decimals=2, step=0.05),
    _setting("terminal.font_weight", "enum", "normal", "字重",
             group="终端", section="字体", order=43, choices=WEIGHT_LABELS),
    _setting("terminal.letter_spacing", "float", 0, "字间距",
             description="像素，可为负数；中文与符号挤在一起时加一点。",
             group="终端", section="字体", order=44,
             minimum=-2, maximum=5, decimals=2, step=0.5),
    _setting("terminal.cursor_style", "enum", "block", "光标样式",
             group="终端", section="光标", order=50, choices=CURSOR_LABELS),
    _setting("terminal.cursor_blink", "bool", True, "光标闪烁",
             group="终端", section="光标", order=51),
    _setting("terminal.scrollback", "int", 5000, "回滚行数",
             description="终端能往回翻多少行，范围 1000–100000。",
             group="终端", section="输出", order=60, minimum=1000, maximum=100000),
    # 动画
    _setting("animation.preset", "enum", "standard", "动画方案",
             description="面板、对话框、提示条与右键菜单都按这一套走。",
             group="动画", order=70, choices=ANIMATION_PRESET_LABELS,
             renderer="animation-preview"),
    _setting("animation.speed", "float", 1, "速度", description="0.5 慢一半，2 快一倍。",
             group="动画", order=71, minimum=0.5, maximum=2, decimals=2, step=0.1),
    # 顶栏
    *(
        _setting(f"header.metrics.{name}", "bool", True, HEADER_METRIC_LABELS[name],
                 group="顶栏", section="指标", order=80 + index)
        for index, name in enumerate(HEADER_METRICS)
    ),
    *(
        _setting(f"header.runs.{name}", "bool", True, HEADER_RUN_LABELS[name],
                 description="只在顶栏的运行服务菜单里筛选，不影响引擎页签的表格。",
                 group="顶栏", section="服务类型", order=90 + index)
        for index, name in enumerate(HEADER_RUN_TYPES)
    ),
    _setting("header.services", "bool", True, "运行服务",
             description="顶栏的运行中服务列表，点开可启动、停止服务。",
             group="顶栏", section="入口", order=100),
    _setting("header.recent", "bool", True, "最近打开",
             description="顶栏的最近打开工作区菜单，点开直接切换工作区。",
             group="顶栏", section="入口", order=101),
    _setting("header.theme", "bool", True, "深浅色切换",
             description="顶栏右侧的明暗主题按钮。",
             group="顶栏", section="入口", order=102),
    # 语言服务器：勾掉的不启动。
    _setting("lsp.disabled", "multi_enum", [], "关闭的语言服务器",
             description="关掉的不会启动，切到对应文件时不拉进程；改动保存后生效。",
             group="语言服务器", order=105, choices=LSP_SERVER_LABELS, clean=_clean_lsp_disabled,
             hidden=True),
    # 快捷键：整组一个控件，保存时整份校验。
    _setting("shortcuts", "json", dict(SHORTCUT_DEFAULTS), "快捷键",
             description="点一下再按新组合；Esc 取消，Backspace 清除。",
             group="快捷键", order=110, renderer="shortcuts", clean=_clean_shortcuts),
)

SETTINGS_BY_KEY = {item.key: item for item in SETTINGS}


def _copy(value):
    if isinstance(value, dict):
        return {key: _copy(item) for key, item in value.items()}
    if isinstance(value, list):
        return list(value)
    return value


def _stored(document):
    """从 settings.json 取 values 表；写坏的结构一律当空，全部回默认。"""
    values = document.get("values") if isinstance(document, dict) else None
    return values if isinstance(values, dict) else {}


def _clean_number(setting, value):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return setting.default
    number = float(value)
    if setting.zero_as_default and number <= 0:
        number = float(setting.default)
    if setting.minimum is not None:
        number = max(setting.minimum, number)
    if setting.maximum is not None:
        number = min(setting.maximum, number)
    if setting.type == "int":
        return int(round(number))
    return round(number, setting.decimals)


def clean_value(setting, value):
    """按登记表归一化一个值；写坏的类型一律退回默认，业务口径不变。"""
    if setting.clean is not None:
        return setting.clean(value)
    if setting.type == "bool":
        return bool(value)
    if setting.type in ("int", "float"):
        return _clean_number(setting, value)
    if setting.type == "enum":
        allowed = [choice[0] for choice in setting.choices]
        return value if value in allowed else setting.default
    if setting.type == "str":
        if not isinstance(value, str):
            return setting.default
        text = " ".join(value.split())
        if setting.max_length:
            text = text[: setting.max_length]
        return text or setting.default
    if setting.type == "dir_list":
        return _clean_search_ignore(value)
    return setting.default


def values_flat(document):
    """从存储取出扁平值：登记过的键一个不少，缺的与写坏的都按默认。"""
    stored = _stored(document)
    out = {}
    for setting in SETTINGS:
        raw = stored.get(setting.key)
        out[setting.key] = _copy(setting.default) if raw is None else clean_value(setting, raw)
    return out


def defaults_flat():
    return {setting.key: _copy(setting.default) for setting in SETTINGS}


def schema_payload():
    return [setting.schema() for setting in SETTINGS]
