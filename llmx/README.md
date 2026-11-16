# llmx

统计 Claude Code、opencode、DeepSeek Harness 的 token 用量，按 DeepSeek 与 mimo 官方价折算成人民币。

## 用法

```
llmx [选项] [命令]

命令:
  daily          按天汇总（默认）
  session        按会话汇总
  hour           按小时汇总
  project        按项目汇总
  api            按 API 地址汇总
  rebuild        清空账本后全量重扫、重建
  db             import 采集入库、status 看账本、gc 清理旧记录
  web            网页看板，SSE 每 3 秒检查一次
  menu           交互菜单

选项:
  -s, --source 名称   claude、opencode、dsh，可重复
  --since 日期        起始日期，含当天
  --until 日期        结束日期，含当天
  --days N            最近 N 天，默认 14
  --all               不限日期
  --json              输出 JSON
  --watch [秒]        原地刷新，默认 5 秒，按 q 退出
  --config 路径       指定配置文件
```

不带参数且连着终端时打开菜单；输出接管道时按 `daily` 出表。常用写法：

```
llmx --all                全部历史
llmx api --all            按接口地址看
llmx -s dsh --since 2026-10-01
llmx --json               给脚本读
llmx --watch 2 --days 1   只看今天，每 2 秒刷新
llmx web --open           打开网页看板
```

报表前几列固定为 `来源`、`模型`、`API 地址`，接着是这张表自己的列（日期、小时、会话、项目等），然后是请求数、各类 token、高峰费用、空闲费用与合计。查不到价格的模型费用显示 `--`，合计只累加计得出来的行。表下会按输入未命中、缓存读、缓存写、输出拆一遍费用。`出处` 列为 `缓存` 的行来自账本，不是本次现扫。

`API 地址` 是请求实际走的地址：Claude Code 取 `ANTHROPIC_BASE_URL`，opencode 取 `provider.<id>.options.baseURL`，DeepSeek Harness 取 profile 补丁里的 `providers.<id>.baseURL`；已入库的记录保留当时的地址。多个地址各成一行，费用仍按模型单价算。

## 原地刷新

`--watch` 在固定位置重画表格，每轮先现扫入库再出数。行数超出屏幕时保留表头与最近几行，宽度不足时省略中间的 API 地址。`--watch` 不能和 `--json`、`--all` 或管道输出一起用；测试时可用 `LLMX_WATCH_FRAMES=N` 让它连出 N 帧就停。

## 网页界面

```
llmx web                      默认 8000，绑所有网卡
llmx web --port 8770          换端口
llmx web --host 127.0.0.1     只给本机用
llmx web --open               自动开浏览器
llmx web --json               只打一行地址，给脚本起服务
llmx web --allow-write        放开配置读写与会话清理
```

页面是 Vuetify + ECharts 的用量看板，含筛选、合计卡片、图表与明细表；左侧菜单有配置管理与价格配置。筛选条件写在地址里，可直接收藏。接口：

- `/api/usage?command=session&days=7&source=dsh`
- `/api/usage/stream`：SSE，默认 3 秒一轮，可用 `every` 指定 1 到 60 秒
- `/api/prices`：当前价格表
- `/api/config`：整份读写价格配置

配置档、`CLAUDE.md` 与会话操作只给本机看，写操作也只认本机；`--allow-write` 才放开。后台常驻用 `setsid nohup llmx web --json >/tmp/llmx-web.log 2>&1 &`。

## 计费规则

高峰是北京时间周一至周五 9:00-12:00、14:00-18:00，其余时段与法定节假日按空闲价（高峰价的一半）。节假日要自己写进配置。

| 项目 | 单价 |
| --- | --- |
| 输入（缓存未命中） | miss 价 |
| 输入（缓存命中） | hit 价 |
| 缓存写入 | 按 miss 价 |
| 输出 | output 价，含思考 token |

默认定价（元 / 百万 token，2026-10）：

| 模型 | 空闲 命中/未命中/输出 | 高峰 命中/未命中/输出 |
| --- | --- | --- |
| deepseek-flash | 0.02 / 1 / 4 | 0.04 / 2 / 8 |
| deepseek-v4-pro | 0.15 / 4.5 / 13.5 | 0.3 / 9 / 27 |
| mimo-v2.6-flash | 0.02 / 1 / 2 | 同空闲 |
| mimo-v2.6-pro | 0.025 / 3 / 6 | 同空闲 |
| mimo-v2.6-pro-ultraspeed | 0.25 / 30 / 60 | 同空闲 |

mimo 只按实时推理价，批量价不采用；模型名带 `free` 的记为免费；模型名会去掉方括号后缀与厂商前缀；历史请求一律按当前价格表重算。

## 用量账本

每次出表先现扫三个来源并写入 `~/.cache/llmx/usage.db`（sqlite3），统计从账本读。会话文件删掉后用量仍能出表；账本不可用时退回纯现扫。

- 主键是来源、会话与去重键：Claude Code 用 `message.id`，opencode 用消息 id，DSH 用 `turn:step`。
- 费用不入账，出表时按当前价现算。
- 日期范围只影响看哪些行，不删记录；清理只在 `db gc` 或 `rebuild`。
- 现扫结果另有快照缓存 `~/.cache/llmx/cache/`，按文件大小与修改时间判断。

```
llmx db status
llmx db import
llmx db gc --keep-days 180
llmx rebuild
```

## 数据来源

| 来源 | 位置 |
| --- | --- |
| Claude Code | `$CLAUDE_CONFIG_DIR/projects/**/*.jsonl`，默认 `~/.claude` |
| opencode | `$XDG_DATA_HOME/opencode/opencode.db`，旧版本回退到 `storage/message` 下的 JSON |
| DeepSeek Harness | `~/.dsh/sessions/*/*/session.v4.jsonl.zstd`，需要 `zstd` |

可用 `LLMX_CLAUDE_DIR`、`LLMX_OPENCODE_DIR`、`LLMX_DSH_SESSIONS` 覆盖位置。已知缺口：DSH 的标题生成与上下文压缩、网页搜索与抓取不计费；Claude Code 子代理会话单独计数；opencode 的 `tokens.total` 重复计算思考 token，不使用该字段。

## 配置

配置默认读 `~/.cache/llmx/config.toml`，也可用 `--config`：

```toml
[models."deepseek-flash"]
off  = { hit = 0.02, miss = 1.0, output = 4.0 }
peak = { hit = 0.04, miss = 2.0, output = 8.0 }

[models."my-free-model"]
free = true

[aliases]
"deepseek-flash[2m]" = "deepseek-flash"

[apis]
"my-gateway" = "http://192.168.1.10:8080/v1"

[peak]
timezone = "Asia/Shanghai"
windows  = ["09:00-12:00", "14:00-18:00"]
weekdays = [0, 1, 2, 3, 4]
holidays = ["2026-10-01"]
```

`weekdays` 0 是周一。网页「价格与配置」页可整份读写这份文件，保存前按加载规则校验；改完下一轮推送就按新价算，不用重启。`[apis]` 的地址优先于从工具配置里读到的值。

```toml
[store]
enabled   = true
db        = "~/.cache/llmx/usage.db"
cache_dir = "~/.cache/llmx/cache"
keep_days = 180
```

## 安装

仓库根目录跑 `./install.sh`，或直接运行 `llmx/bin/llmx`。也可以绕开入口：

```
PYTHONPATH=llmx/lib python3 -m llmx --all
```

需要 Python 3.11+，读 DSH 日志需要 `zstd`；其余是标准库。菜单依赖 `bash-tui` 与 bash 4.2+。
