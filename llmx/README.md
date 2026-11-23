# llmx

统计 Claude Code、opencode、DeepSeek Harness 的 token 用量，按 DeepSeek 与 mimo 官方价折算成人民币。命令行出表，也可以开网页看板。

## 安装

在仓库根目录执行 `./install.sh`。需要 Python 3.11 以上；读 DeepSeek Harness 日志还需要 `zstd`。

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
  web            网页看板
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

不带参数且连着终端时打开菜单；输出接管道时按 `daily` 出表。

```
llmx --all                全部历史
llmx api --all            按接口地址看
llmx -s dsh --since 2026-10-01
llmx --json               给脚本读
llmx --watch 2 --days 1   只看今天，每 2 秒刷新
llmx web --open           打开网页看板
```

## 网页看板

```
llmx web                      默认 8000，绑所有网卡
llmx web --port 8770          换端口
llmx web --host 127.0.0.1     只给本机用
llmx web --open               自动开浏览器
llmx web --json               只打一行地址，给脚本起服务
llmx web --allow-write        放开配置读写与会话清理
```

页面含筛选、合计卡片、图表与明细表，左侧菜单可管理配置与价格。筛选条件写在地址里，可直接收藏。配置档、`CLAUDE.md` 与会话操作只给本机看，写操作也只认本机。

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

模型名带 `free` 的记为免费；历史请求按当前价格表重算。查不到价格的模型费用显示 `--`。

## 数据来源

| 来源 | 位置 |
| --- | --- |
| Claude Code | `$CLAUDE_CONFIG_DIR/projects/**/*.jsonl`，默认 `~/.claude` |
| opencode | `$XDG_DATA_HOME/opencode/opencode.db` |
| DeepSeek Harness | `~/.dsh/sessions/*/*/session.v4.jsonl.zstd` |

可用 `LLMX_CLAUDE_DIR`、`LLMX_OPENCODE_DIR`、`LLMX_DSH_SESSIONS` 覆盖位置。DSH 的标题生成与上下文压缩、网页搜索与抓取不计费。

## 配置

配置默认读 `~/.cache/llmx/config.toml`，也可用 `--config` 指定。改完下一轮出数就按新价算，不用重启。

```toml
[models."deepseek-flash"]
off  = { hit = 0.02, miss = 1.0, output = 4.0 }
peak = { hit = 0.04, miss = 2.0, output = 8.0 }

[models."my-free-model"]
free = true

[peak]
timezone = "Asia/Shanghai"
windows  = ["09:00-12:00", "14:00-18:00"]
weekdays = [0, 1, 2, 3, 4]
holidays = ["2026-10-01"]
```

`weekdays` 的 0 是周一。网页「价格与配置」页可整份读写这份文件。
