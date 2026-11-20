"""代码索引的 LSP 桥接：按语言拉起语言服务器，问定义，把结果换回工作副本相对路径。

只用标准库；一个语言服务器一条子进程 io 会话，帧是 Content-Length + UTF-8 JSON。
管理器按（工作区, 语言）懒启动，空闲回收，服务退出时全部停掉。

实现按职责分在 lsp_protocol / lsp_servers / lsp_tsserver / lsp_session / lsp_manager，
这里统一再导出，调用方与测试仍然只认这一个入口。
"""

from lsp import *  # noqa: F401,F403
