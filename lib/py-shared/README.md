# py-shared

nodex、jvmx、dvcsx、llmx 四个网页进程共用的 Python 骨架。不是可执行工具：各工具的 `server.py`（llmx 是 `web/__init__.py`）按路径把它加进 `sys.path` 后直接 import，无需构建。只用标准库，保持 Python 3.7 可导入。

## 目录

```
web.py / toolweb.py / runtime.py          路由、接口骨架、启动流程
sse.py / metrics.py / tomlout.py          SSE、指标、TOML 输出
stores.py / kvstore.py / runner.py        状态行、行式存储、执行端
fileio.py / pathutil.py / netutil.py      文件、路径、监听地址
browse.py / toolchain.py                  目录浏览、Node/JDK 运行时
testkit.py / test/                        测试脚手架与共享用例
```

## 怎么接

`server.py` 顶部按 `__file__` 找到 `lib/py-shared` 并加进 `sys.path`；源码与安装目录层级一致。每个 `Handler` 继承 `WebHandler`（需要日志推送再加 `SSEMixin`），实现自己的 `_dispatch`；流式接口覆写 `_stream_routes`。nodex 再继承 `toolweb.ToolHandler`，只补 `build_state`、`_tool_get`、`_tool_post`、`_tool_update_args`。启动走 `runtime.py`：`check_static`、`start_streams`、`serve`。

`testkit.py` 提供 `load_module`、`serve`、`read_sse_event`、`json_call`、`poll_until`；它不 import 其他共享模块。自身用例：`python3 -I lib/py-shared/test/test_shared.py`。

## 导出

| 导出 | 用途 |
| ---- | ---- |
| `WebHandler` | `do_GET/HEAD/POST`、路由、跨站写校验、读 JSON、静态页面 |
| `ToolHandler` | nodex 的公共路由；工具独有路由走 `_tool_get` / `_tool_post` |
| `check_static`、`start_streams`、`serve` | 起网页进程的公共骨架 |
| `SSEMixin` | `_sse_start` / `_sse` / `_stream_log` |
| `log_page`、`LineBuffer`、`last_lines`、`sse_data`、`sse_event`、`tail` | 日志分页、切行与 SSE 报文 |
| `Fanout`、`StateStream`、`MetricsStream` | 一份数据推给所有页面；`SSE_INTERVAL` 默认 3 秒 |
| `Metrics` | `/proc` 与 statvfs 取 CPU、内存、磁盘、网速 |
| `dumps`、`Inline` | 把嵌套字典写成 TOML；读用 `tomllib` |
| `Row`、`AliasStore`、`HomeStore`、`FS` | 状态行取值、别名与工具链目录 |
| `attach_alias_rel`、`attach_home` | 把别名、相对路径、工具链目录拼进工作区列表 |
| `Sessions` | 起进程、等退出码、整组杀进程 |
| `EngineClient`、`ToolEngine`、`parse_reserve` | 常驻执行端管路与 nodex 的引擎动作 |
| `StateRows` | 状态文件 mtime 缓存与按行查找 |
| `parse_fixed_rows`、`run_info`、`run_log_path`、`latest_runs` | 固定列宽解析与运行记录 |
| `list_dirs` | 列家目录一层的子目录 |
| `read_json`、`write_json`、`atomic_write_text`、`read_text_preview`、`write_text_preserve_newlines` | 安全读写与原子落盘 |
| `within`、`safe_relative`、`static_target` | 路径越界校验与静态文件定位 |
| `is_any_host`、`is_loopback_address`、`parse_host`、`guess_lan_address`、`host_url` | 监听地址 |
| `LineStore` | 行式键值存储基类 |
| `iter_home_dirs`、`effective_home`、`prepend_bin` | 运行时目录发现与环境拼装 |
| `ApiError`、`STREAMED`、`CONTENT_TYPES`、`log` | 公共小件 |

## 放进来之前

- 只放真正同构的东西：命令拼装、业务动作、状态列宽留在各工具。
- dvcsx 的 SSE 写法不同，只共用 `WebHandler` 与 `sse` 小件；llmx 保留自己的 HEAD、静态缓存与扫描锁。
- 业务不进共享层：价格表、来源解析、SQLite 账本、SVN/Git 命令与错误文案都留在原项目。
