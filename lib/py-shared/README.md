# py-shared

nodex、mvnx、dvcsx 三个网页进程共用的 Python 骨架。不是工具，没有可执行入口；源码被各自的 `server.py` 按路径加进 `sys.path` 后直接引用，不需要构建。只用标准库，Python 3.7 起。

## 目录

```
web.py       请求路由、JSON 回话、静态页面、监听地址与 ApiError
sse.py       行缓冲、日志尾部、SSE 拼装、Fanout、状态与指标推送、SSEMixin
metrics.py   CPU、内存、磁盘指标
stores.py    FS、状态行 Row、工作区别名 AliasStore
```

## 三个工程怎么接

`server.py` 顶部按 `__file__` 找到仓库根的 `lib/py-shared`，放进 `sys.path` 后按模块名引用：

```python
sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "lib" / "py-shared"))

from web import ApiError, CONTENT_TYPES, STREAMED, WebHandler, is_any, guess_host
from sse import LineBuffer, StateStream, tail
from stores import FS, AliasStore, Row
```

源码目录与 `~/.local/share/bash-scripts` 安装目录的层级一致，两种布局都能找到。测试用 `importlib` 直接执行 `server.py`，所以导入进来的名字仍挂在 `server` 模块上，`server.xxx` 的引用不用改。

每个 `Handler` 继承 `WebHandler`（需要日志推送的再加 `SSEMixin`），只实现自己的 `_dispatch`；GET 里要先接下的流式接口覆写 `_stream_routes`，返回 `True` 表示已经写完。dvcsx 的 `log` 带时间戳，留在自己那边。

## 里面有什么

| 导出 | 用途 |
| ---- | ---- |
| `WebHandler` | `do_GET/HEAD/POST`、路由、跨站写请求校验、读 JSON、静态页面、`_json` / `_send` |
| `SSEMixin` | `_sse_start` / `_sse` / `_stream_log`，三端里 nodex、mvnx 用 |
| `LineBuffer`、`last_lines`、`sse_data`、`sse_event`、`tail` | 日志切行、尾部补发与 SSE 报文 |
| `Fanout`、`StateStream`、`MetricsStream` | 一份数据推给所有页面 |
| `Metrics` | `/proc` 与 statvfs 取 CPU、内存、磁盘 |
| `Row`、`AliasStore`、`FS` | 状态行取值与工作区别名 |
| `ApiError`、`STREAMED`、`CONTENT_TYPES`、`log`、`is_any`、`guess_host` | 公共小件 |

## 放进来之前先想清楚

- **只放真正同构的东西。** `State`、`Engine`、`Sessions` 与各工具的状态文件列号、命令拼装绑在一起，留在自己的 `server.py`。
- **dvcsx 的 SSE 写法与 nodex、mvnx 不同。** 只共用通用的 `WebHandler` 与 `sse` 小件，不硬套 `SSEMixin`。
- **状态行的列数各算各的。** `Row` 是通用的，`WIDTHS` 与 `parse_rows` 跟着各工具的状态文件走。
