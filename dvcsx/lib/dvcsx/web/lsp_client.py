"""代码索引的 LSP 桥接：按语言拉起语言服务器，问定义，把结果换回工作副本相对路径。

只用标准库；一个语言服务器一条子进程 io 会话，帧是 Content-Length + UTF-8 JSON。
管理器按（工作区, 语言）懒启动，空闲回收，服务退出时全部停掉。

实现按职责分在 lsp_protocol / lsp_servers / lsp_tsserver / lsp_session / lsp_manager，
这里统一再导出，调用方与测试仍然只认这一个入口。
"""

from lsp_protocol import (
    MAX_EDIT_FILE,
    MAX_LOCATIONS,
    LspError,
    LspUnavailable,
    apply_text_edits,
    apply_workspace_edit,
    encode_message,
    inside,
    lsp_hover_text,
    normalize_diagnostics,
    normalize_locations,
    normalize_symbols,
    normalize_workspace_edit,
    path_to_uri,
    position_to_index,
    read_message,
    tsserver_diagnostics,
    tsserver_hover_text,
    tsserver_locations,
    tsserver_rename_plan,
    tsserver_symbols,
    uri_to_path,
)
from lsp_servers import SERVERS, language_id, server_key, typescript_lib, which_node
from lsp_session import LspServer, stop_instance
from lsp_tsserver import TsserverBridge
from lsp_manager import LspManager

__all__ = [
    "MAX_EDIT_FILE",
    "MAX_LOCATIONS",
    "LspError",
    "LspUnavailable",
    "LspManager",
    "LspServer",
    "SERVERS",
    "TsserverBridge",
    "apply_text_edits",
    "apply_workspace_edit",
    "encode_message",
    "inside",
    "language_id",
    "lsp_hover_text",
    "normalize_diagnostics",
    "normalize_locations",
    "normalize_symbols",
    "normalize_workspace_edit",
    "path_to_uri",
    "position_to_index",
    "read_message",
    "server_key",
    "stop_instance",
    "tsserver_diagnostics",
    "tsserver_hover_text",
    "tsserver_locations",
    "tsserver_rename_plan",
    "tsserver_symbols",
    "typescript_lib",
    "uri_to_path",
    "which_node",
]
