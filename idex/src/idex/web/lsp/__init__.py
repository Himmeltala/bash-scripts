# @Author: Himmeltala
# @Date: 2026-11-26 09:29:54
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-26 09:29:54
# @FilePath: \idex\src\idex\web\lsp\__init__.py
# @Description: 代码索引的 LSP 桥接实现：协议、服务器表、tsserver 桥、会话与管理器。

"""对外的再导出集中在 lsp_client，那边是唯一入口。"""


from .protocol import (
    MAX_EDIT_FILE,
    MAX_LOCATIONS,
    LspError,
    LspUnavailable,
    apply_text_edits,
    apply_workspace_edit,
    encode_message,
    inside,
    lsp_hover_text,
    normalize_completions,
    normalize_diagnostics,
    normalize_format_edits,
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
from .servers import SERVERS, language_id, server_key, typescript_lib, which_node
from .session import LspServer, stop_instance
from .tsserver import TsserverBridge
from .vue import TsslsBridge, merge_diagnostics, vue_block
from .manager import LspManager

__all__ = [
    "MAX_EDIT_FILE",
    "MAX_LOCATIONS",
    "LspError",
    "LspUnavailable",
    "LspManager",
    "LspServer",
    "SERVERS",
    "TsserverBridge",
    "TsslsBridge",
    "apply_text_edits",
    "apply_workspace_edit",
    "encode_message",
    "inside",
    "language_id",
    "lsp_hover_text",
    "merge_diagnostics",
    "normalize_completions",
    "normalize_diagnostics",
    "normalize_format_edits",
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
    "vue_block",
    "which_node",
]
