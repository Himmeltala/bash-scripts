# @Author: Himmeltala
# @Date: 2026-11-26 09:29:54
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-26 09:29:54
# @FilePath: \idex\src\idex\web\lsp_client.py
# @Description: 代码索引的 LSP 桥接：按语言拉起语言服务器，问定义，把结果换回工作副本相对路径。

"""只用标准库；一个语言服务器一条子进程会话，帧为 Content-Length + UTF-8 JSON。实现按职责分在 lsp_* 模块，这里统一再导出，调用方与测试只认这个入口。"""

from lsp import *  # noqa: F401,F403
