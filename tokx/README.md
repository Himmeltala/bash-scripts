# tokx

统计本机三个编码代理的 token 用量，并按 DeepSeek 与 mimo 的官方单价折算成人民币费用：Claude Code、opencode、DeepSeek Harness。

## 用法

```
tokx [选项] [命令]

命令:
  daily      按天汇总，每个模型、每个接口地址一行，默认命令
  session    按会话汇总，每个模型、每个接口地址一行
  hour       按一天内的小时分布汇总，每个模型、每个接口地址一行
  rebuild    清空账本后全量重扫、重建
  db         用量账本：import 采集入库，status 看概况，gc 清理过期记录
  web        在浏览器里看用量，定时自动刷新
  menu       打开交互菜单

选项:
  -s, --source 名称   只看某个来源，可选 claude、opencode、dsh，可重复
  --since 日期        起始日期，含当天，格式 YYYY-MM-DD
  --until 日期        结束日期，含当天，格式 YYYY-MM-DD
  --days N            最近 N 天，默认 14
  --all               不限日期
  --json              输出 JSON，供脚本读取
  --watch [秒]        每 N 秒原地刷新一次表格，默认 5 秒，按 q 或 Ctrl+C 退出
  --config 路径       指定配置文件
```

不带任何参数、并且三个标准流都连着终端时打开交互菜单；输出接管道或重定向时仍按 `daily` 出表，脚本里的行为不变。

常用写法：

```
tokx                                  不带参数，连着终端时打开菜单
tokx menu                             显式打开菜单，管道里也能用
tokx --all                            全部历史
tokx session --all                    按会话看，找出最贵的会话
tokx hour --all                       按时段看，看高峰时段用了多少
tokx -s dsh --since 2026-10-01        只看 DeepSeek Harness
tokx --json                           输出 JSON，交给脚本处理
tokx db status                        看账本里存了多少、覆盖到哪天
tokx --watch                          每天每 5 秒原地重画一次，盯着用量涨
tokx session --watch 2 --days 1       按会话看今天，每 2 秒刷新
tokx web                              打开网页界面
tokx web --open --days 7              网页界面并自动开浏览器，默认看近 7 天
```

`daily` 的输出（下表是示例数据，只用来说明格式）。一行是某天某个来源的某个模型走的某个接口地址，一个来源用了几个模型、几个接口地址就出几行，各算各的费用。总 token 是输入、缓存读、缓存写与输出之和，缓存读也算消耗；`--all` 时合计行就是全部历史的总量：

```
来源      模型            API 地址                            日期        出处  请求    输入     缓存读    输出   总 token  高峰费用  空闲费用      合计
--------  --------------  ----------------------------------  ----------  ----  ----  ------  ---------  ------  ---------  --------  --------  --------
claude    deepseek-flash  https://api.anthropic.com           2026-10-26         120  12,000    300,000   8,000    320,000   ¥1.2000   ¥0.6000   ¥1.8000
claude    deepseek-flash  https://api.anthropic.com           2026-10-27          98   9,500    240,000   6,400    255,900   ¥0.9820   ¥0.4910   ¥1.4730
opencode  deepseek-flash  https://api.deepseek.com            2026-10-27          15   1,200     20,000     900     22,100   ¥0.0500   ¥0.0250   ¥0.0750
dsh       deepseek-flash  https://api.deepseek.com/anthropic  2026-10-27         210  25,000    900,000  15,000    940,000   ¥4.8000   ¥2.4000   ¥7.2000
dsh       qwen3.8-27b     https://api.deepseek.com/anthropic  2026-10-27          40   8,000          0   2,000     10,000        --        --        --
合计                                                                             483  55,700  1,460,000  32,300  1,548,000   ¥7.0320   ¥3.5160  ¥10.5480

未计价模型：qwen3.8-27b；这些行没有单价，费用显示 --，合计只累加计得出来的行。
```

三张表的前几列统一：`来源`、`模型`、`API 地址`，接着是这张表自己的时间列（按天是 `日期`、按小时是 `小时` 与 `时段`、按会话是 `开始`、`会话`、`项目`），然后是 `请求` 到 `合计` 那八列数字。

`出处` 列留空的是本次现扫到的行；会话文件已经不在了、数字从账本读回来的行标成 `缓存`，表下会多一行说明。

`API 地址` 列是请求实际走的接口地址：Claude Code 取设置文件里的 `ANTHROPIC_BASE_URL`，opencode 取配置文件里 `provider.<id>.options.baseURL`，DeepSeek Harness 取 profile 补丁里 `providers.<id>.baseURL`。配置里没写地址的常见 provider 用内置默认地址，其余查不到时显示 `-`。地址按当前配置解析，换了地址后旧日期也跟着变。同一模型走了多个地址时，各地址单独成行；费用仍按模型单价计算。

## 原地刷新

`--watch` 让表格画在同一个位置、隔一段时间重画一次，不再每次往终端下面追一份：

```
tokx --watch                  日报，每 5 秒刷新
tokx --watch 2 --days 1       每 2 秒刷新，只看今天
tokx session --watch 10       按会话看，每 10 秒刷新
```

- 每轮都重新现扫，新写进会话文件的用量下一轮就出现；账本这一侧的写入与普通出表相同。
- 表格按窗口宽高裁剪：行太多时保留表头与最近的几行，中间换成"另有 N 行未显示"；宽度不够时把中间的 API 地址省略，两头的数字列保住。终端窄到放不下整张表时，直接提示表格要多少列。
- 写 `--watch` 时不带秒数用 5 秒；秒数也可以写成 `--watch=3`。放在子命令前后都认：`tokx --watch 3 daily` 与 `tokx daily --watch 3` 等价。
- 按 `q` 或 Ctrl+C 退出，退出时的终端设置会还原，终端里留着最后一帧。
- `--watch` 只出表格：和 `--json` 一起用会报错；`--all` 配 `--watch` 也会报错，全量表塞不进一屏，看全量时去掉 `--watch` 翻屏看。
- 输出没接终端（`tokx --watch | cat`）时报错退出，免得脚本里无限循环。测试时可用环境变量 `TOKX_WATCH_FRAMES=N` 让它连出 N 帧就停。

## 网页界面

`tokx web` 在本机起一个只读的小服务，浏览器打开就是一个可筛选的用量看板：

```
tokx web                      绑所有网卡，打印局域网地址后按 Ctrl+C 退出
tokx web --port 8770          固定端口
tokx web --host 127.0.0.1     只给本机用，别的机器连不上
tokx web --open               起好后顺手打开默认浏览器
tokx web --json               给脚本用：只打一行 {"url","local","host","port"} 再接着服务
```

- 默认绑 `0.0.0.0`，端口交给系统挑，打印的是局域网里能直接打开的地址（按出口网卡猜，猜不出来退回 `127.0.0.1`），另给一行本机地址。网页没有登录，同一网络里能连上的人都能看用量和接口地址；只想本机看就加 `--host 127.0.0.1`。
- 想在后台常驻：`setsid nohup tokx web --port 8780 --json >/tmp/tokx-web.log 2>&1 &`。加了 `--json` 才能重定向，否则 stdout 接管道会直接报错。
- 数据与 `--json` 同源：每一轮推送都重新现扫、导入账本、按当前价格表计价，页面上看到的就是此刻 `tokx --json` 的数字。配置也每轮重读，改了 `~/.claude/settings.json` 里的 `ANTHROPIC_BASE_URL` 或价格表，不用重启服务。
- 页面保持一条 SSE 连接，服务端按“自动刷新”选的间隔推来整份报表，不再定时发请求；连上先推一条，换筛选条件或推送间隔就按新参数重连。选“关闭”时断开连接，只手动刷新；标签页切到后台断开，切回来重连并立刻拿到最新数据。
- 界面用 Vuetify 3 组件拼，ECharts 图表的配色取自 Vuetify 主题。标题栏右上角可以切深浅色，没手动切过时跟着系统走。
- 页面里有合计卡片、费用柱状图、可排序的明细表；出处标成"缓存"的行有不同底色，与命令行一致。
- 柱状图用 ECharts，颜色按来源区分：Claude Code 紫、opencode 橙、DeepSeek Harness 蓝，图例写在图内右上角。
  - 按天报表：每天里各来源分别花了多少，同一天的几根柱子并排。
  - 按小时报表看两张，横轴都是 0 到 23 点：左边是每小时合计，落在高峰窗口的小时画橙柱、其余画蓝柱；右边把同一个小时按来源拆开。左图一根柱子的高度等于右图同一个小时几根柱子之和。
- 当前筛选写在地址里了：`http://127.0.0.1:8770/?command=hour&range=all` 这样带参数的链接打开就是那个视图，可以直接收藏或发给别人。
- 筛选都在页面上改，也可以直接拼查询串：`/api/usage?command=session&days=7&source=dsh`，日期用 `since`、`until`，与命令行同名同义。`/api/usage/stream` 是同一份数据的 SSE 推送，多一个 `every` 指定秒数；`/api/prices` 给当前价格表。
- `--json` 只打一行地址就转去服务，适合脚本起服务；stdout 不是终端又没加 `--json` 时直接报错，免得接上管道后服务挂在后台。

前端是 Vite + Vue 3 + Vuetify 3 + ECharts，源码在 `tokx/web/`，打包产物提交在 `tokx/lib/tokx/web/static/`，所以用 `./install.sh` 装整棵树以后不需要 Node。改前端时：

```
cd tokx/web && npm install
npm run dev        开发服务（默认 5173），/api 代理到 TOKX_WEB_ORIGIN，默认 http://127.0.0.1:8770
npm run build      打包到 tokx/lib/tokx/web/static，提交时连产物一起提交
```

开发时另开一个终端先 `tokx web --port 8770`，Vite 的热更新才有数据可取。

Vuetify 的默认入口只装主题与图标，不带组件，`web/vite.config.js` 里用别名把 `vuetify` 指到带组件的入口，模板里的 `v-app`、`v-data-table` 这些才有人认。`@mdi/font` 的字体文件会一起打进 `static/assets/`，图标在离线与局域网里都能显示。

服务端只认静态文件：加了带哈希的资源长期缓存，首页 `no-cache`，`/api` 不缓存，其余路径回落到首页由页面自己按地址栏还原筛选。

## 交互界面

不带参数运行 `tokx`，并且三个标准流都连着终端时，进入交互菜单：先选报表，再选统计范围，最后勾来源。

1. 报表：按日汇总、按会话汇总、按小时汇总、价格表。
2. 范围：今天、近 7 天、近 14 天、近 30 天、全部历史、自定义起止日期。
3. 来源：Claude Code、opencode、DeepSeek Harness，默认全选，空格勾掉不要的。

报表跑完后会问一次"就这么看，还是盯着刷新"：选"盯着刷新"就退到普通屏上每 5 秒原地重画，按 `q` 退出；选"看完"则按任意键回菜单，输入 `q` 退出。报表直接打在终端上，等待提示不会切走屏幕，现有输出保持可见。没有画进界面里的分页，是因为会话表有 15 列，塞进一屏会裁掉右侧的高峰与空闲费用列。

菜单由仓库共用的 `bash-tui` 绘制，与其他工具一致。探不到终端时退回编号输入，所以 `tokx menu` 也能在管道里驱动：

```
printf '1\n5\n1 3\n1\n5\n' | tokx menu    按日汇总、全部历史、只勾 claude 与 dsh，看完回菜单再退出
```

界面里的选择与命令行选项等价，`--config`、`TOKX_CONFIG` 等环境变量照常生效。没装 `bash-tui` 时，`tokx` 不带参数会退回默认范围的日报，`tokx menu` 则直接报错。

## 计费规则

高峰时段是北京时间周一至周五的 9:00 到 12:00 与 14:00 到 18:00，其余时段按空闲价，空闲价是高峰价的一半。法定节假日全天按空闲价，节假日日期需要写进配置，程序不内置。

计费口径：

| 项目               | 单价                                |
| ------------------ | ----------------------------------- |
| 输入（缓存未命中） | miss 价                             |
| 输入（缓存命中）   | hit 价                              |
| 缓存写入           | 按 miss 价，DeepSeek 不单独收写入费 |
| 输出               | output 价，含思考 token             |

默认单价来自 DeepSeek 与 mimo 的官方价（2026 年 10 月），单位是元每百万 token。mimo 不分峰谷，两档同价：

| 模型                     | 空闲·命中 | 空闲·未命中 | 空闲·输出 | 高峰·命中 | 高峰·未命中 | 高峰·输出 |
| ------------------------ | --------- | ----------- | --------- | --------- | ----------- | --------- |
| deepseek-flash           | 0.02      | 1           | 4         | 0.04      | 2           | 8         |
| deepseek-v4-pro          | 0.15      | 4.5         | 13.5      | 0.3       | 9           | 27        |
| mimo-v2.6-flash          | 0.02      | 1           | 2         | 0.02      | 1           | 2         |
| mimo-v2.6-pro            | 0.025     | 3           | 6         | 0.025     | 3           | 6         |
| mimo-v2.6-pro-ultraspeed | 0.25      | 30          | 60        | 0.25      | 30          | 60        |


另外几条：

- mimo 分实时推理与批量推理两套价，批量价大约是实时价的一半；三个来源发的都是实时请求，所以按实时价计，批量价不采用。
- 模型名带 `free` 的记为免费，例如 opencode 的 `deepseek-v4.1-flash-free`，只统计 token，费用为 0。
- 查不到价格的模型照样出表，占自己的一行，token 照常统计，高峰费用、空闲费用、合计三列显示 `--`；`--` 表示没有可用的金额，不是 0。同一来源的其他模型不受牵连，金额照常给出。
- 合计行只累加计得出来的行，表下注明未计价的是哪几个模型。
- 模型名会去掉方括号后缀与厂商前缀，`deepseek-flash[1m]` 按 `deepseek-flash` 计价。
- Claude Code 如果走代理或中转站，代理的加价与折扣不体现，这里算的是 DeepSeek 与 mimo 的官方价。
- 历史请求一律按当前价格表重算，官方调价后，旧日期的费用会跟着变。

## 用量账本

报表每次运行时现扫三个来源，同时把扫到的每条请求写进本机账本 `~/.local/state/tokx/usage.db`（sqlite3）。会话文件被删掉、被工具自己清理以后，账本里的用量照样出表，不会因为文件没了就从报表里消失。

- 一行一条请求，主键是来源、会话与去重键，重复导入不会翻倍。去重键：Claude Code 用 `message.id`，opencode 用消息 id，DeepSeek Harness 用 `turn:step`。
- 接口地址与费用不入账，出表时按当前配置与当前价格表现算，改价、换地址后历史数字照常跟着变。
- 本次没扫到的会话，记录从账本读回来，`出处` 列标成 `缓存`，表下也有一行说明；正常现扫的行 `出处` 留空。
- 会话文件被重写变短时以现扫为准：同一会话这次采到的条数比账本里见过的最大值少，就删掉这个会话的旧记录再写，不会把已经不存在的请求当成历史回显。
- 现扫结果另有一层快照缓存 `~/.local/state/tokx/cache/<来源>.json`，按文件大小与修改时间判断，没变的会话不重复解压；缓存丢了只会慢一点，不影响数字。
- 账本目录可以用 `TOKX_STATE_DIR` 换位置，配置里的 `[store]` 节可以整个关掉或改路径。

维护命令：

```
tokx db status              账本有多少条、覆盖到哪天、各来源多少
tokx db import              只采集入库、不出报表，适合挂到工具的结束钩子上
tokx db gc --keep-days 180  清掉 180 天内没再出现的会话
tokx rebuild                清空账本后按当前口径全量重扫，改过采集口径或时区后执行
```

## 数据来源

| 来源             | 位置                                          | 说明                                                                               |
| ---------------- | --------------------------------------------- | ---------------------------------------------------------------------------------- |
| Claude Code      | `~/.claude/projects/**/*.jsonl`             | 一条回复按内容块写成多行，按 `message.id` 合并，取 token 数最大的那一行          |
| opencode         | `~/.local/share/opencode/opencode.db`       | 读 `message` 表，旧版本回退到 `storage/message` 下的 JSON                      |
| DeepSeek Harness | `~/.dsh/sessions/*/*/session.v4.jsonl.zstd` | 需要 `zstd` 命令，模型从 `request/header` 事件取，同一步骤重试只留最后一次结算；只读每个会话版本号最高的那一代日志 |

三个位置都可以用环境变量覆盖：`TOKX_CLAUDE_DIR`、`TOKX_OPENCODE_DIR`、`TOKX_DSH_SESSIONS`。读接口地址的配置位置另有 `TOKX_OPENCODE_CONFIG` 与 `TOKX_DSH_PROFILES`。

已知缺口：

- DeepSeek Harness 的标题生成与上下文压缩请求没有记录 usage，未计入。
- 网页搜索与抓取按成功次数计费，每千次 5 元，和 token 无关，未计入。
- Claude Code 的子代理会话写在独立的 jsonl 里，会单独计数，不会并进父会话。
- Claude Code 的日志不记录接口地址，API 地址列取当前设置文件里的 `ANTHROPIC_BASE_URL`；换过地址时，旧会话也显示当前地址。
- opencode 的 `tokens.total` 把思考 token 又加了一遍，tokx 不使用该字段，直接按 input、output、cache 拆分。

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

[apis]
"my-gateway" = "http://192.168.1.10:8080/v1"

[peak]
timezone = "Asia/Shanghai"
windows  = ["09:00-12:00", "14:00-18:00"]
weekdays = [0, 1, 2, 3, 4]
holidays = ["2026-10-01", "2026-10-02", "2026-10-03"]
```

`weekdays` 用 0 表示周一，用 6 表示周日。`holidays` 只列法定节假日当天，程序不内置，因为每年安排不同，需要自己补。

`[apis]` 按 provider 覆盖接口地址，优先于从各工具配置文件里读到的值。日志里只记 provider，地址靠配置文件补；配置里查不到、`[apis]` 也没写时，表里显示 `-`。

账本与快照缓存的位置也可以配置，默认放在 `~/.local/state/tokx`：

```toml
[store]
enabled   = true                          # 关掉后完全按现扫出表，不回显、不写账本
db        = "~/.local/state/tokx/usage.db"
cache_dir = "~/.local/state/tokx/cache"
keep_days = 180                           # db gc 默认保留多少天
```

## 安装

在仓库根目录执行 `./install.sh`，它会把 `tokx/bin/tokx` 软链到 `~/.local/bin/tokx`。也可以直接运行 `tokx/bin/tokx`。

入口是 bash，负责菜单与分发；采集、计价与出表在 `tokx/lib/tokx` 下的 Python 包里，也可以绕开入口直接调：

```
PYTHONPATH=tokx/lib python3 -m tokx --all
```

依赖：Python 3.11 或更高版本（用到 `tomllib`），读 DeepSeek Harness 时需要 `zstd` 命令，其余都是标准库。菜单依赖 `bash-tui` 与 bash 4.2 以上，由仓库根下的 `lib/tui-path.sh` 定位。
