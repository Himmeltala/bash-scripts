# py-shared

nodex、mvnx、dvcsx、tokx 四个网页进程共用的 Python 骨架与工具。不是工具，没有可执行入口；源码被各自的 `server.py`（tokx 是 `web/__init__.py`）按路径加进 `sys.path` 后直接引用，不需要构建。共享层只用标准库、保持 Python 3.7 可导入；tokx 自身仍要求 3.11。

## 目录

```
web.py       请求路由、JSON 回话、静态页面、监听地址与 ApiError
sse.py       行缓冲、日志尾部、SSE 拼装、Fanout、状态与指标推送、SSEMixin、日志分页
metrics.py   CPU、内存、磁盘指标
stores.py    FS、状态行 Row、工作区别名 AliasStore 与 attach_alias_rel
runner.py    进程会话 Sessions、执行端 EngineClient、状态缓存 StateRows、运行记录工具函数
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

每个 `Handler` 继承 `WebHandler`（需要日志推送的再加 `SSEMixin`），只实现自己的 `_dispatch`；GET 里要先接下的流式接口覆写 `_stream_routes`，返回 `True` 表示已经写完。dvcsx 的 `log` 带时间戳，留在自己那边；tokx 还没整体换成 `WebHandler`，只共用小件。

`testkit.py` 仅供测试：`load_module` 载入 `server.py`，`serve` 起临时 `ThreadingHTTPServer`，`read_sse_event` 读 SSE，`json_call` 收发 JSON，`poll_until` 等后台任务。它不 import 其他共享模块，测试文件显式把 `lib/py-shared` 加进 `sys.path` 即可（`python3 -I` 下也一样）。共享层自己的用例在 `test/test_shared.py`，用 `python3 -I lib/py-shared/test/test_shared.py` 运行。

## 里面有什么

| 导出 | 用途 |
| ---- | ---- |
| `WebHandler` | `do_GET/HEAD/POST`、路由、跨站写请求校验、读 JSON、静态页面、`_json` / `_send` |
| `SSEMixin` | `_sse_start` / `_sse` / `_stream_log`，nodex、mvnx 用 |
| `log_page` | 运行日志的分页读取，返回字段与 nodex/mvnx 原来的 `_log` 一致 |
| `LineBuffer`、`last_lines`、`sse_data`、`sse_event`、`tail` | 日志切行、尾部补发与 SSE 报文 |
| `Fanout`、`StateStream`、`MetricsStream` | 一份数据推给所有页面 |
| `Metrics` | `/proc` 与 statvfs 取 CPU、内存、磁盘 |
| `Row`、`AliasStore`、`FS` | 状态行取值与工作区别名 |
| `attach_alias_rel` | 把别名与相对家目录的路径拼进工作区列表 |
| `Sessions` | 起进程、等退出码、整组杀进程；`fallback` 可选，给没写 shebang 的启动器兜底 |
| `EngineClient` | 常驻执行端的管路：按行请求、断了重拉；子类只给命令、环境变量与业务动作 |
| `StateRows` | 状态文件的 mtime 缓存与按行查找；子类只实现 `parse_rows` 与 `snapshot` |
| `parse_fixed_rows`、`run_info`、`run_log_path`、`latest_runs` | 固定列宽的记录解析、运行记录字段、日志路径与最新运行去重 |
| `list_dirs` | 列家目录内某一层的子目录，越界、符号链接、权限与截断都处理好 |
| `read_json`、`write_json`、`atomic_write_text`、`read_text_preview`、`write_text_preserve_newlines` | 安全读写与原子落盘 |
| `within`、`safe_relative`、`resolve_under`、`static_target` | 路径越界校验与静态文件定位 |
| `is_any_host`、`is_loopback_address`、`parse_host`、`guess_lan_address`、`host_url` | 监听地址与回环判断 |
| `LineStore` | 行式键值存储基类：加锁、原子写、`normalize/validate/decode` 钩子 |
| `iter_home_dirs`、`effective_home`、`prepend_bin` | Node/JDK 等运行时的目录发现与环境变量拼装 |
| `testkit` 里的 `load_module`、`serve`、`read_sse_event`、`json_call`、`poll_until` | 测试脚手架 |
| `ApiError`、`STREAMED`、`CONTENT_TYPES`、`log`、`is_any`、`guess_host` | 公共小件 |

## 放进来之前先想清楚

- **只放真正同构的东西。** `EngineClient` 只管请求管路，命令拼装、`reserve` 的字段与业务动作留在各自的 `server.py`；`StateRows` 只管缓存与查找，`parse_rows`、`snapshot` 由各工具给。
- **dvcsx 的 SSE 写法与 nodex、mvnx 不同。** 只共用通用的 `WebHandler` 与 `sse` 小件，不硬套 `SSEMixin`。
- **tokx 的 HTTP 外壳暂未整体替换。** 它保留自己的 HEAD 行为、`assets/` 的 immutable 缓存、全局扫描锁与 `UsageError` 映射，只共用 `netutil`、`sse_data`、`WebServer`、`fileio` 等小件。
- **状态行的列数各算各的。** `Row` 是通用的，`WIDTHS` 与 `parse_rows` 跟着各工具的状态文件走。
- **业务不进共享层。** 价格表、来源解析、TOML 配置、SQLite 账本、SVN/Git 命令与解析、各工具的错误文案都留在原项目。
