# py-shared

idex、llmx、netx 共用的 Python 骨架。不是可执行工具，只用标准库，保持 Python 3.7 可导入。

## 使用

各工具的 `server.py` 按 `__file__` 定位本目录，把 `commons` 与 `services` 加进 `sys.path` 后直接 import，无需构建。

```
commons/    文件、路径、监听地址、TOML、行式存储、测试脚手架
services/   WebHandler、SSE、指标、状态存储、进程执行、目录浏览
```

`services` 可引用 `commons`，反过来不行。两层按模块名平铺导入，模块名不能重名。

## 扩展

`Handler` 继承 `WebHandler` 并实现 `_dispatch`；需要日志推送时加 `SSEMixin`。idex 的 Handler 按功能组合路由类，Node 引擎继承 `runner.py` 的 `ToolEngine`。启动走 `runtime.py` 的 `check_static`、`start_streams`、`serve`。

## 测试

```bash
python3 -I lib/py-shared/test/test_shared.py
```
