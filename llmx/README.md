# llmx

统计 Claude Code、opencode、DeepSeek Harness 的 token 用量与费用。

## 安装

仓库根目录执行 `./install.sh`。需要 Python 3.11 以上；读 DeepSeek Harness 日志需要 `zstd`。

## 用法

```
llmx [选项] [命令]

命令: daily（默认）、session、hour、project、api、rebuild、db、web、menu
```

| 选项 | 说明 |
| --- | --- |
| `-s, --source 名称` | claude、opencode、dsh，可重复 |
| `--since 日期` | 起始日期，含当天 |
| `--until 日期` | 结束日期，含当天 |
| `--days N` | 最近 N 天，默认 14 |
| `--all` | 不限日期 |
| `--json` | 输出 JSON |
| `--watch [秒]` | 原地刷新，默认 5 秒，按 q 退出 |
| `--config 路径` | 指定配置文件 |

网页看板：

```
llmx web                      默认 8000，绑所有网卡
llmx web --port 8770          换端口
llmx web --host 127.0.0.1     只给本机
llmx web --open               自动开浏览器
llmx web --json               只打一行地址
llmx web --allow-write        放开配置读写与会话清理
```

配置默认读 `~/.cache/llmx/config.toml`。
