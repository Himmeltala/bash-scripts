# claudex

管理本机 Claude Code 会话：列出、继续、归档、恢复、删除，并清理运行缓存。

## 用法

```
claudex                              打开菜单
claudex list [--all] [--older-than N]
claudex resume <会话id或前缀>         切到原目录并执行 claude --resume
claudex archive <会话id...> [--yes]
claudex delete <会话id...> [--yes]
claudex archives                     列出归档
claudex restore [<会话id>] [--yes]
claudex cache [编号] [--days N] [--yes]
```

归档、删除与缓存清理默认只预览，加 `--yes` 才执行。

## 会话数据

一个会话由四块数据组成，共用同一个 id：

```
~/.claude/projects/<编码项目目录>/<会话id>.jsonl   正文
~/.claude/projects/<编码项目目录>/<会话id>/       工具结果
~/.claude/file-history/<会话id>/                  文件修改历史
~/.claude/session-env/<会话id>/                   会话环境
```

项目目录名不可逆，原路径从正文的 `cwd` 取。运行中的会话由 `~/.claude/sessions/<pid>.json` 判断（pid 存在且命令行含 `claude`），只能查看，不能继续、归档或删除。

## 归档

归档根默认 `~/.claude/archive`，可用 `CLAUDEX_ARCHIVE_DIR` 覆盖；按 `<日期>/<会话id>/` 存放四块数据与 `meta`、`title`。恢复按 `meta` 放回原项目，目标已存在就拒绝。同一 id 在不同日期归档过时，按 id 恢复会报歧义。

## 缓存清理

| 编号 | 内容 | 默认 |
| --- | --- | --- |
| `cache.snapshots` | 超过 N 天的 shell 快照与 paste 缓存 | 勾选 |
| `cache.orphans` | 找不到正文的 file-history、session-env 与会话目录 | 勾选 |
| `cache.plugins` | 清空 `plugins/cache` | 不勾选 |
| `cache.history` | 删除 `history.jsonl`，清空 `daemon.log` | 不勾选 |

阈值默认 7 天，用 `--days` 改。孤儿判定以现有 jsonl 的 id 为准；`memory` 与运行中的会话跳过。

## 安全约定

- 归档、删除、缓存清理默认只预览。
- 所有路径必须在 `~/.claude` 或归档根内，拒绝 `..`、符号链接与系统目录。
- 运行中的会话拒绝操作；删除会话保留项目目录与 `memory`。
- 恢复时目标已存在就拒绝。

## 退出码

| 码 | 含义 |
| -- | --- |
| 0 | 成功或预览完成 |
| 1 | 至少一项没完成 |
| 2 | 用法错误，包括 id 前缀歧义 |
| 3 | 用户取消 |
