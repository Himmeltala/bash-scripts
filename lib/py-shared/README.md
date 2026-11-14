# py-shared

nodex、mvnx、dvcsx、tokx 四个网页进程共用的 Python 骨架与工具。不是工具，没有可执行入口；源码被各自的 `server.py`（tokx 是 `web/__init__.py`）按路径加进 `sys.path` 后直接引用，不需要构建。共享层只用标准库、保持 Python 3.7 可导入；tokx 自身仍要求 3.11。

## 目录

```
web.py       请求路由、JSON 回话、静态页面、监听地址与 ApiError
toolweb.py   nodex 与 mvnx 的接口骨架 ToolHandler（状态、日志、指标、别名与启停）
runtime.py   起网页进程：检查打包目录、起监听、就绪行、信号与开浏览器
sse.py       行缓冲、日志尾部、SSE 拼装、Fanout、状态与指标推送、SSEMixin、日志分页
metrics.py   CPU、内存、磁盘指标
stores.py    FS、状态行 Row、别名 AliasStore、工作区工具链目录 HomeStore 与 attach_*
runner.py    进程会话 Sessions、执行端 EngineClient/ToolEngine、状态缓存 StateRows、运行记录工具函数
browse.py    家目录内的目录浏览 list_dirs
fileio.py    原子写、JSON 安全读写、文本预览、保留换行写回
pathutil.py  路径包含校验、工作副本内相对路径、静态文件定位
netutil.py   监听地址、回环判断、host 解析、对外地址推测
kvstore.py   行式键值存储基类 LineStore（别名、Node/JDK 等选择共用）
toolchain.py Node/JDK 等运行时的目录发现、校验与环境变量拼装
testkit.py   测试辅助：载入 server.py、起临时 HTTP 服务、读 SSE、JSON 调用、轮询
test/        共享层的 unittest（python3 -I test/test_shared.py）
```

## 四个工程怎么接

`server.py` 顶部按 `__file__` 找到仓库根的 `lib/py-shared`，放进 `sys.path` 后按模块名引用：

```python
sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "lib" / "py-shared"))

from web import ApiError, CONTENT_TYPES, STREAMED, WebHandler, is_any, guess_host
from sse import LineBuffer, StateStream, tail, log_page
from stores import FS, AliasStore, Row, attach_alias_rel
from runner import EngineClient, Sessions, StateRows, parse_fixed_rows, run_info
from browse import list_dirs
from fileio import read_json, write_json, read_text_preview
from pathutil import safe_relative, within
from netutil import is_loopback_address
from kvstore import LineStore
from toolchain import iter_home_dirs, effective_home, prepend_bin
```

源码目录与 `~/.local/share/bash-scripts` 安装目录的层级一致，两种布局都能找到。测试用 `importlib` 直接执行 `server.py`，所以导入进来的名字仍挂在 `server` 模块上，`server.xxx` 的引用不用改。tokx 的 `web/__init__.py` 在同一层级（`parents[4]`），`snapshot.py` 与 `api.py` 用 `parents[3]`。

每个 `Handler` 继承 `WebHandler`（需要日志推送的再加 `SSEMixin`），只实现自己的 `_dispatch`；GET 里要先接下的流式接口覆写 `_stream_routes`，返回 `True` 表示已经写完。nodex 与 mvnx 再上一层继承 `toolweb.ToolHandler`，公共路由在共享层，工具只补 `build_state`、`_tool_get`、`_tool_post` 与 `_tool_update_args`。dvcsx 的 `log` 带时间戳，留在自己那边。tokx 用 `WebHandler` 管路由、JSON 与错误回话，但保留自己的静态缓存策略、HEAD 行为与扫描锁。

启动骨架走 `runtime.py`：`check_static` 检查打包目录，`start_streams` 起推送线程，`serve` 负责绑定端口、打印 READY 行、处理信号与开浏览器。nodex/mvnx 的 `serve()` 只组装状态、引擎与 Handler。

`testkit.py` 仅供测试：`load_module` 载入 `server.py`，`serve` 起临时 `ThreadingHTTPServer`，`read_sse_event` 读 SSE，`json_call` 收发 JSON，`poll_until` 等后台任务。它不 import 其他共享模块，测试文件显式把 `lib/py-shared` 加进 `sys.path` 即可（`python3 -I` 下也一样）。共享层自己的用例在 `test/test_shared.py`，用 `python3 -I lib/py-shared/test/test_shared.py` 运行。

## 里面有什么

| 导出 | 用途 |
| ---- | ---- |
| `WebHandler` | `do_GET/HEAD/POST`、路由、跨站写请求校验、读 JSON、静态页面、`_json` / `_send` |
| `ToolHandler` | nodex/mvnx 的公共路由：状态与推送、日志、指标、目录选择、增删工作区、别名、启停与 update；工具独有的路由走 `_tool_get` / `_tool_post` |
| `check_static`、`start_streams`、`serve` | 起网页进程的公共骨架；`serve` 的 `ready` 给 bash 认的那行前缀 |
| `SSEMixin` | `_sse_start` / `_sse` / `_stream_log`，nodex、mvnx、tokx 用 |
| `log_page` | 运行日志的分页读取，返回字段与 nodex/mvnx 原来的 `_log` 一致 |
| `LineBuffer`、`last_lines`、`sse_data`、`sse_event`、`tail` | 日志切行、尾部补发与 SSE 报文 |
| `Fanout`、`StateStream`、`MetricsStream` | 一份数据推给所有页面；`SSE_INTERVAL` 是所有推送的默认间隔（5 秒） |
| `Metrics` | `/proc` 与 statvfs 取 CPU、内存、磁盘 |
| `Row`、`AliasStore`、`HomeStore`、`FS` | 状态行取值、工作区别名与工具链目录（空值删行） |
| `attach_alias_rel`、`attach_home` | 把别名、相对家目录的路径、选中的工具链目录与失效标记拼进工作区列表 |
| `Sessions` | 起进程、等退出码、整组杀进程；`fallback` 可选，给没写 shebang 的启动器兜底 |
| `EngineClient` | 常驻执行端的管路：按行请求、断了重拉；子类只给命令、环境变量与业务动作 |
| `ToolEngine`、`parse_reserve` | nodex/mvnx 共用的增删工作区、停止与 reserve 回话解析 |
| `StateRows` | 状态文件的 mtime 缓存与按行查找；子类只实现 `parse_rows` 与 `snapshot` |
| `parse_fixed_rows`、`run_info`、`run_log_path`、`latest_runs` | 固定列宽的记录解析、运行记录字段、日志路径与最新运行去重 |
| `list_dirs` | 列家目录内某一层的子目录，越界、符号链接、权限与截断都处理好 |
| `read_json`、`write_json`、`atomic_write_text`、`read_text_preview`、`write_text_preserve_newlines` | 安全读写与原子落盘 |
| `within`、`safe_relative`、`static_target` | 路径越界校验与静态文件定位 |
| `is_any_host`、`is_loopback_address`、`parse_host`、`guess_lan_address`、`host_url` | 监听地址与回环判断 |
| `LineStore` | 行式键值存储基类：加锁、原子写、`normalize/validate/decode` 钩子 |
| `iter_home_dirs`、`effective_home`、`prepend_bin` | Node/JDK 等运行时的目录发现与环境变量拼装 |
| `testkit` 里的 `load_module`、`serve`、`read_sse_event`、`json_call`、`poll_until` | 测试脚手架 |
| `ApiError`、`STREAMED`、`CONTENT_TYPES`、`log`、`is_any`、`guess_host` | 公共小件 |

## 放进来之前先想清楚

- **只放真正同构的东西。** `EngineClient` 只管请求管路，命令拼装、`reserve` 的字段与业务动作留在各自的 `server.py`；`StateRows` 只管缓存与查找，`parse_rows`、`snapshot` 由各工具给。
- **dvcsx 的 SSE 写法与 nodex、mvnx 不同。** 只共用通用的 `WebHandler` 与 `sse` 小件，不硬套 `ToolHandler`。
- **tokx 保留页面自己的策略。** `WebHandler` 只管路由与错误回话；HEAD 的空回话、`assets/` 的 immutable 缓存、静态文件回落首页、全局扫描锁与 `UsageError` 映射仍在 `tokx/web/__init__.py`。
- **状态行的列数各算各的。** `Row` 是通用的，`WIDTHS` 与 `parse_rows` 跟着各工具的状态文件走。
- **业务不进共享层。** 价格表、来源解析、TOML 配置、SQLite 账本、SVN/Git 命令与解析、各工具的错误文案都留在原项目。
