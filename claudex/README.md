# claudex

管理本机 Claude Code 会话：列出项目与会话、继续会话、归档与恢复归档、删除旧会话，并清理运行缓存。不带命令时打开菜单。

## 用法

```
claudex                              打开菜单
claudex list                         列出当前目录所属项目的会话
claudex list --all                   列出全部项目的会话
claudex list --all --older-than 30   只看 30 天前修改的会话
claudex resume <会话id或前缀>         切到原目录并执行 claude --resume
claudex archive <会话id...>          归档，默认只预览
claudex archive <会话id...> --yes    真正归档
claudex delete <会话id...> --yes     永久删除，默认只预览
claudex archives                     列出归档条目
claudex restore                      交互选择归档并恢复
claudex restore <会话id> --yes       按 id 恢复归档
claudex cache                        预览默认缓存清理项
claudex cache cache.orphans --yes    只清孤儿关联数据
claudex cache --days 30 --yes        按 30 天阈值清默认项
claudex --help                       显示帮助
```

会话 id 支持唯一前缀，至少 4 位。前缀匹配到多个时会列出候选并退出。

界面里 ↑↓ 移动，空格勾选，回车确认，`q` 取消，`[` `]` 翻页。会话列表每页最多 15 行，底部显示当前页范围。

## 会话数据

一个会话由四块数据组成，共用同一个 session id：

```
~/.claude/projects/<编码项目目录>/<会话id>.jsonl      正文
~/.claude/projects/<编码项目目录>/<会话id>/          工具结果
~/.claude/file-history/<会话id>/                     文件修改历史
~/.claude/session-env/<会话id>/                      会话环境
```

项目目录名里的非 ASCII 字符会被替换成 `-`，不能用来反推真实路径。工具从正文的 `cwd` 字段取原路径，继续会话时切换到那里。

运行中的会话从 `~/.claude/sessions/<pid>.json` 判断：pid 还活着且进程命令行含 `claude` 就算运行中。运行中的会话可以看见，但不能继续、归档或删除。

## 归档

归档根目录默认 `~/.claude/archive`，可用 `CLAUDEX_ARCHIVE_DIR` 覆盖。布局：

```
<归档根>/<YYYY-MM-DD>/<会话id>/
├── session.jsonl
├── session/
├── file-history/
├── session-env/
├── meta
└── title
```

`meta` 保存会话 id、项目目录名与原路径，`title` 保存标题原文。恢复时按 `meta` 放回原项目目录；目标已存在就拒绝，不覆盖。归档是移动，四项数据全部成功才算完成，中途失败会回滚。

同一个会话 id 在不同日期各归档一次时，按 id 恢复会报歧义，需要先看 `claudex archives`。

## 缓存清理

| 编号 | 内容 | 默认 |
| --- | --- | --- |
| `cache.snapshots` | `shell-snapshots/snapshot-bash-*` 与 `paste-cache/*` 中超过 N 天的文件 | 勾选 |
| `cache.orphans` | 找不到对应正文的 `file-history`、`session-env` 与会话目录 | 勾选 |
| `cache.plugins` | 清空 `plugins/cache`，插件可能重新下载 | 不勾选 |
| `cache.history` | 删除 `history.jsonl`，把 `daemon.log` 清空 | 不勾选 |

天数默认 7，用 `--days` 改。孤儿判定以现有 jsonl 的 id 为准，`projects/*/memory` 永远跳过，运行中的会话也跳过。插件缓存只清 `cache` 子目录，不碰 `installed_plugins.json`、`marketplaces` 与 `data`。`daemon.log` 用 `truncate -s 0`，不删文件。

## 安全约定

- 归档、删除、缓存清理默认只预览，打印将执行的 `mv`、`rm` 命令与大小；加 `--yes` 才动盘。
- 所有移动与删除路径必须在 `~/.claude` 或归档根目录内，拒绝 `..`、符号链接与系统目录。
- 运行中的会话一律拒绝继续、归档与删除。
- 删除会话保留项目目录与 `memory`，即使项目目录删空了也不动。
- 恢复归档时目标已存在就拒绝，不静默覆盖。
- 归档根目录由环境变量指定时，不能落在 `/`、家目录本身或 `/usr`、`/etc`、`/var` 等系统目录。

## 退出码

| 码 | 含义 |
| --- | --- |
| 0 | 成功，或预览完成 |
| 1 | 至少有一项没完成 |
| 2 | 用法错误，包括 id 前缀歧义 |
| 3 | 用户取消 |

## 已知限制

- 只支持 Linux，依赖 GNU coreutils 的 `stat`、`du`、`find`、`truncate`。
- 标题从 `ai-title` 记录按文本提取，标题含转义字符时可能原样显示；没有标题时显示会话 id 前 8 位。
- 不管理后台任务、daemon 状态与插件安装记录。
- 恢复归档时若原项目已改名，会按 `meta` 里的目录名重建，`cwd` 是否仍有效由用户判断。
- `claude` 命令必须在 PATH 里，继续会话才可用。

## 验证

```bash
bash -n claudex/bin/claudex claudex/lib/claudex-core.sh claudex/lib/claudex/*.sh
bash claudex/test/run.sh
```

测试在临时 HOME 与临时归档目录里造假的 `~/.claude` 树，覆盖列表、预览、归档、恢复、删除、运行中保护与四类缓存清理，不会动真实数据。
