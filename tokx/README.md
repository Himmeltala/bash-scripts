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

`daily` 的输出（下表是示例数据，只用来说明格式）。总 token 是输入、缓存读、缓存写与输出之和，缓存读也算消耗；`--all` 时合计行就是全部历史的总量：

```
来源      日期        请求  输入    缓存读     输出    总 token   高峰费用  空闲费用  合计
--------  ----------  ----  ------  ---------  ------  ---------  --------  --------  --------
claude    2026-10-26  120   12,000  300,000    8,000   320,000    ¥1.2000   ¥0.6000   ¥1.8000
claude    2026-10-27  98    9,500   240,000    6,400   255,900    ¥0.9820   ¥0.4910   ¥1.4730
opencode  2026-10-27  15    1,200   20,000     900     22,100     ¥0.0500   ¥0.0250   ¥0.0750
dsh       2026-10-27  210   25,000  900,000    15,000  940,000    ¥4.8000   ¥2.4000   ¥7.2000
合计                  443   47,700  1,460,000  30,300  1,538,000  ¥7.0320   ¥3.5160   ¥10.5480
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
- 网页搜索与抓取按成功次数计费，每千次 5 元，和 token 无关，未计入。
- Claude Code 的子代理会话写在独立的 jsonl 里，会单独计数，不会并进父会话。
- opencode 的 `tokens.total` 把思考 token 又加了一遍，tokx 不使用该字段，直接按 input、output、cache 拆分。

## 与 ccusage 的差异

Claude Code 把一条回复按内容块写成多行，每一行都带着同一份 usage。按行累加的工具会把同一份 usage 重复计入，数字自然偏大；`ccusage` 20.0.26 就是这么算的，结果大约是 tokx 的两倍。

举个例子：一条回复的 usage 是输入 100、输出 20，Claude Code 把它写成 2 行，每行都记着这组数。按行累加得到输入 200、输出 40；tokx 按 `message.id` 只算一次，仍然是输入 100、输出 20。

两个工具的数字对不上时，先查这一点。

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
