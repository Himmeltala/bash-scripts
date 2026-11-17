# @Author: Himmeltala
# @Date: 2026-11-15 19:35:44
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-17 23:35:13
# @FilePath: \lib\py-shared\commons\tomlout.py
# @Description: TOML 输出：把字典按插入顺序写成配置文件文本。

import json
import re
from datetime import date, datetime, time

# 不带引号也合法的键；其余一律按基本字符串写，带点、空格、中文的模型名就不会被拆开。
_BARE = re.compile(r"^[A-Za-z0-9_-]+$")


class Inline(dict):
    """写成行内表的字典：off = { hit = 0.02, miss = 1.0, output = 4.0 }。"""


def _key(name):
    text = str(name)
    return text if _BARE.match(text) else json.dumps(text, ensure_ascii=False)


def _value(value):
    if isinstance(value, Inline):
        return _inline(value)
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return repr(value)
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if isinstance(value, (list, tuple)):
        return "[" + ", ".join(_value(item) for item in value) + "]"
    if isinstance(value, dict):
        raise TypeError("字典要写成表或 Inline：%r" % (value,))
    raise TypeError("不支持的值类型：%r" % (value,))


def _inline(table):
    if not table:
        return "{}"
    parts = ["%s = %s" % (_key(k), _value(v)) for k, v in table.items()]
    return "{ " + ", ".join(parts) + " }"


def _write(table, path, out):
    scalars = []
    tables = []
    for key, value in table.items():
        if isinstance(value, dict) and not isinstance(value, Inline):
            tables.append((key, value))
        else:
            scalars.append((key, value))

    if path and (scalars or not tables):
        out.append("[%s]" % ".".join(_key(part) for part in path))
        for key, value in scalars:
            out.append("%s = %s" % (_key(key), _value(value)))
        out.append("")
    elif not path:
        for key, value in scalars:
            out.append("%s = %s" % (_key(key), _value(value)))
        if scalars and tables:
            out.append("")

    for key, value in tables:
        _write(value, path + [key], out)


def dumps(data, header=""):
    """把嵌套字典写成 TOML 文本；header 原样放在最前面，当作说明注释。"""
    out = []
    if header:
        out.append(header.rstrip("\n"))
        out.append("")
    _write(data, [], out)
    text = "\n".join(out).strip("\n")
    return text + "\n" if text else "\n"
