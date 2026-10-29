# tokx

统计本机三个编码代理的 token 用量，并按 DeepSeek 官方单价折算成人民币费用：Claude Code、opencode、DeepSeek Harness。

## 能回答的问题

- 最近 14 天、指定日期区间各用了多少 token，三个工具各占多少。
- 每条请求落在高峰还是空闲时段，两个时段分别花了多少钱。
- 哪个会话最贵，一天里哪个小时用量最大。
- 换价格或换模型时，改配置文件即可，不用改代码。

## 用法

```
tokx [选项] [命令]

命令:
  daily      按天汇总，默认命令
  session    按会话汇总
  hour       按一天内的小时分布汇总
  prices     打印当前价格表

选项:
  -s, --source 名称   只看某个来源，可选 claude、opencode、dsh，可重复
  --since 日期        起始日期，含当天，格式 YYYY-MM-DD
  --until 日期        结束日期，含当天，格式 YYYY-MM-DD
  --days N            最近 N 天，默认 14
  --all               不限日期
  --json              输出 JSON，供脚本读取
  --config 路径       指定配置文件
```

常用写法：

```
tokx                                  最近 14 天，按天汇总
tokx --all                            全部历史
tokx session --all                    按会话看，找出最贵的会话
tokx hour --all                       按时段看，看高峰时段用了多少
tokx -s dsh --since 2026-10-01        只看 DeepSeek Harness
tokx --json                           输出 JSON，交给脚本处理
```

`daily` 的输出（示例数据，2026-10-29 本机）。总 token 是输入、缓存读、缓存写与输出之和，缓存读也算消耗；`--all` 时合计行就是全部历史的总量：

```
来源      日期         请求       输入         缓存读       输出       总 token  高峰费用  空闲费用      合计
--------  ----------  -----  ---------  -------------  ---------  -------------  --------  --------  --------
claude    2026-10-26  1,942  2,102,297    532,635,904  1,478,470    536,216,671  ¥18.5850   ¥9.3764  ¥27.9614
claude    2026-10-27  1,822  2,027,507    377,012,352    934,296    379,974,155  ¥15.9392   ¥5.3353  ¥21.2745
claude    2026-10-28  1,167  1,355,392    206,118,272    724,697    208,198,361   ¥8.4134   ¥4.1699  ¥12.5832
claude    2026-10-29  1,387  1,883,236    125,643,136    874,034    128,400,406  ¥12.4532   ¥1.6656  ¥14.1188
opencode  2026-10-29    158    198,757      7,840,000     32,059      8,070,816   ¥0.0000   ¥0.0000   ¥0.0000
dsh       2026-10-29  1,641  1,253,642    316,024,192  1,457,447    318,735,281  ¥16.4835   ¥5.1622  ¥21.6457
合计                  8,117  8,820,831  1,565,273,856  5,501,003  1,579,595,690  ¥71.8742  ¥25.7094  ¥97.5836
```

## 计费规则

高峰时段是北京时间周一至周五的 9:00 到 12:00 与 14:00 到 18:00，其余时段按空闲价，空闲价是高峰价的一半。法定节假日全天按空闲价，节假日日期需要写进配置，程序不内置。

计费口径：

| 项目 | 单价 |
| --- | --- |
| 输入（缓存未命中） | miss 价 |
| 输入（缓存命中） | hit 价 |
| 缓存写入 | 按 miss 价，DeepSeek 不单独收写入费 |
| 输出 | output 价，含思考 token |

默认单价来自 2026 年 10 月的 DeepSeek 官方价，单位是元每百万 token：

| 模型 | 空闲·命中 | 空闲·未命中 | 空闲·输出 | 高峰·命中 | 高峰·未命中 | 高峰·输出 |
| --- | --- | --- | --- | --- | --- | --- |
| deepseek-flash | 0.02 | 1 | 4 | 0.04 | 2 | 8 |
| deepseek-v4-pro | 0.15 | 4.5 | 13.5 | 0.3 | 9 | 27 |

另外几条：

- 模型名带 `free` 的记为免费，例如 opencode 的 `deepseek-v4.1-flash-free`，只统计 token，费用为 0。
- 查不到价格的模型只统计 token，费用不计入，并在 stderr 提示模型名。
- 模型名会去掉方括号后缀与厂商前缀，`deepseek-flash[1m]` 按 `deepseek-flash` 计价。
- Claude Code 如果走代理或中转站，代理的加价与折扣不体现，这里算的是 DeepSeek 官方价。
- 历史请求一律按当前价格表重算，DeepSeek 调价后，旧日期的费用会跟着变。

## 数据来源

| 来源 | 位置 | 说明 |
| --- | --- | --- |
| Claude Code | `~/.claude/projects/**/*.jsonl` | 一条回复按内容块写成多行，按 `message.id` 合并，取 token 数最大的那一行 |
| opencode | `~/.local/share/opencode/opencode.db` | 读 `message` 表，旧版本回退到 `storage/message` 下的 JSON |
| DeepSeek Harness | `~/.dsh/sessions/*/*/session.v4.jsonl.zstd` | 需要 `zstd` 命令，模型从 `request/header` 事件取，同一步骤重试只留最后一次结算 |

三个位置都可以用环境变量覆盖：`TOKX_CLAUDE_DIR`、`TOKX_OPENCODE_DIR`、`TOKX_DSH_SESSIONS`。

已知缺口：

- DeepSeek Harness 的标题生成与上下文压缩请求没有记录 usage，未计入。
- 网页搜索与抓取按成功次数计费，每次 5 元每千次，和 token 无关，未计入。
- Claude Code 的子代理会话写在独立的 jsonl 里，会单独计数，不会并进父会话。
- opencode 的 `tokens.total` 把思考 token 又加了一遍，tokx 不使用该字段，直接按 input、output、cache 拆分。

## 与 ccusage 的差异

本机同时装了 `ccusage`，它的 Claude Code 数字大约是 tokx 的两倍。原因是 Claude Code 把一条回复按内容块写成多行，每行都带同一份 usage；ccusage 20.0.26 把这些行全部累加，tokx 按 `message.id` 只算一次。以 2026-10-27 为例，ccusage 报输入 4,854,374、缓存读 806,382,464、输出 2,098,724，正好等于该日所有行的总和；tokx 按消息去重后是输入 2,027,507、缓存读 377,012,352、输出 934,296。

## 配置

配置文件默认读 `~/.config/tokx/config.toml`，也可以用 `--config` 指定。改价格、加模型、补节假日都在这里：

```toml
[models."deepseek-flash"]
off  = { hit = 0.02, miss = 1.0, output = 4.0 }
peak = { hit = 0.04, miss = 2.0, output = 8.0 }

[models."my-free-model"]
free = true

[aliases]
"deepseek-flash[2m]" = "deepseek-flash"

[peak]
timezone = "Asia/Shanghai"
windows  = ["09:00-12:00", "14:00-18:00"]
weekdays = [0, 1, 2, 3, 4]
holidays = ["2026-10-01", "2026-10-02", "2026-10-03"]
```

`weekdays` 用 0 表示周一，用 6 表示周日。`holidays` 只列法定节假日当天，程序不内置，因为每年安排不同，需要自己补。

## 安装

在仓库根目录执行 `./install.sh`，它会把 `tokx/bin/tokx` 软链到 `~/.local/bin/tokx`。也可以直接运行 `tokx/bin/tokx`。

依赖：Python 3.11 或更高版本（用到 `tomllib`），读 DeepSeek Harness 时需要 `zstd` 命令，其余都是标准库。

## 测试

```
bash tokx/test/run.sh
```

测试在临时 HOME 里造三个来源的假数据，覆盖去重、峰谷定价、节假日、来源过滤、日期过滤与 JSON 输出。
