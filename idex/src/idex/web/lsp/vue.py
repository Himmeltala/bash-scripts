# @Author: Himmeltala
# @Date: 2026-11-26 09:29:54
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-26 09:29:54
# @FilePath: \idex\src\idex\web\lsp\vue.py
# @Description: Vue 单文件组件的分工：模板交给 Vue 语言服务器，脚本交给 TypeScript 语言服务器。

def vue_block(text, line):
    """行号落在哪个顶层块：template、script、style，不在块里返回空串；只认行首标签，模板里缩进的 <template v-if> 不算。"""
    lines = str(text or "").splitlines()
    try:
        number = int(line)
    except (TypeError, ValueError):
        return ""
    if number < 0 or number >= len(lines):
        return ""
    block = ""
    for index, raw in enumerate(lines):
        # 模板里可以嵌 <template v-if>，只认行首那个；脚本与样式块允许缩进。
        start = raw if raw.startswith("<template") else raw.lstrip()
        opened = ""
        for name in ("template", "script", "style"):
            if start.startswith("<" + name) and not start.startswith("</" + name):
                opened = name
                break
        if index == number:
            return block or opened
        if block:
            closing = raw if block == "template" else raw.lstrip()
            if closing.startswith("</" + block):
                block = ""
        elif opened:
            block = opened
    return ""


class TsslsBridge:
    """把 tsserver 请求交给 typescript-language-server 的 executeCommand；Vue 的 _vue:* 命令由带 @vue/typescript-plugin 的 tsserver 回答，不必另起一条。"""

    def __init__(self, server, timeout=20.0):
        self.server = server
        self.timeout = timeout

    def forward(self, name, arguments):
        raw = self.server.request(
            "workspace/executeCommand",
            {
                "command": "typescript.tsserverRequest",
                "arguments": [name, arguments, {"isAsync": True, "lowPriority": True}],
            },
            timeout=self.timeout,
        )
        if isinstance(raw, dict) and "body" in raw:
            return raw["body"]
        return raw


def merge_diagnostics(*groups):
    """把两个服务器对同一文件的诊断合起来，按位置与内容去重。"""
    seen = set()
    out = []
    for items in groups:
        for item in items or []:
            if not isinstance(item, dict):
                continue
            key = (
                item.get("line"),
                item.get("character"),
                item.get("severity"),
                item.get("message"),
            )
            if key in seen:
                continue
            seen.add(key)
            out.append(item)
    out.sort(key=lambda item: (item.get("line") or 0, item.get("character") or 0))
    return out
