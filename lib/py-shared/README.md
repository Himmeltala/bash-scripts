# py-shared

nodex、jvmx、idex、llmx 四个网页进程共用的 Python 骨架。不是可执行工具，只用标准库，保持 Python 3.7 可导入。

## 使用

各工具的 `server.py` 按 `__file__` 找到本目录，把 `commons` 与 `services` 加入 `sys.path` 后直接 import，无需构建。

```
commons/    通用小件：文件、路径、监听地址、TOML、行式存储、测试脚手架
services/   业务骨架：WebHandler、ToolHandler、SSE、指标、状态存储、进程执行、目录浏览
```

`services` 可以引用 `commons`，反过来不行；两层按名字平铺导入，模块名不能重名。

`Handler` 继承 `WebHandler`，实现 `_dispatch`；需要日志推送时再加 `SSEMixin`。nodex 继承 `ToolHandler`，只补 `build_state`、`_tool_get`、`_tool_post`、`_tool_update_args`。启动走 `runtime.py` 的 `check_static`、`start_streams`、`serve`。

## 测试

```bash
python3 -I lib/py-shared/test/test_shared.py
```
