# @Author: Himmeltala
# @Date: 2026-11-26 09:29:54
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-26 09:29:54
# @FilePath: \idex\src\idex\web\terminal\__init__.py
# @Description: 工作区终端：PTY 会话、WebSocket 协议与服务端路由。

"""工作区终端：PTY 会话、WebSocket 协议与服务端路由。"""

from .routes import TerminalRoutes
from .service import TerminalManager

__all__ = ["TerminalManager", "TerminalRoutes"]
