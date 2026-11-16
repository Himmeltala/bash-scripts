# cleanx

清理 Linux 家目录与系统垃圾，分用户缓存、系统包与日志、开发缓存三类，另带大文件与构建产物扫描。默认只预览，加 `--yes` 才删除。

## 用法

```
cleanx                         打开菜单，勾选后确认清理
cleanx user                    预览用户类默认清理项
cleanx user --yes              执行用户类清理
cleanx user user.trash --yes   只清回收站
cleanx system                  预览系统类（命令带 sudo，不执行）
cleanx dev --yes               清理开发缓存
cleanx scan                    扫描家目录大文件
cleanx scan --min-size 1G --top 50
cleanx build-scan              扫描 node_modules、target 等构建产物
cleanx list [类别]             列出清理项编号与可用状态
cleanx -n ...                  强制预览
```

不带类别进菜单；带类别默认只打印大小与命令，`--yes` 才动磁盘，`-n` 优先于 `--yes`。不写编号就执行该类默认勾选项；路径不存在的项不出现在菜单里。

## 清理项

| 编号 | 类别 | 说明 | 默认 |
| --- | --- | --- | --- |
| `user.thumbnails` | user | 缩略图缓存 | 勾选 |
| `user.fontconfig` | user | 字体索引缓存 | 勾选 |
| `user.browser` | user | Firefox / Chrome 网页缓存 | 不勾选 |
| `user.trash` | user | 清空回收站 | 勾选 |
| `sys.apt` | system | `apt-get clean` | 勾选 |
| `sys.journal` | system | 日志保留 14 天 | 勾选 |
| `sys.tmp` | system | `systemd-tmpfiles --clean` | 不勾选 |
| `dev.maven` / `dev.gradle` | dev | `~/.m2/repository`、`~/.gradle/caches` | 勾选 |
| `dev.npm` / `dev.yarn` / `dev.pnpm` / `dev.pip` | dev | 包管理器缓存 | 勾选 |
| `dev.go` / `dev.cargo` | dev | Go 与 Rust 缓存 | 勾选 |
| `dev.ide` | dev | JetBrains 与 VS Code 缓存 | 不勾选 |
| `dev.docker` | dev | 悬空镜像与构建缓存，需要 docker 与 sudo | 勾选 |

## 安全约定

- 路径解析后必须仍在 `$HOME` 内，`$HOME` 本身、`/` 与含 `..` 的路径拒绝。
- 符号链接不跟随；挂载点只清内容。
- 回收站的 `files` 与 `info` 成对删除。
- 系统类用系统自带命令：`apt-get clean`、`journalctl --vacuum-time`、`systemd-tmpfiles --clean`。
- Docker 只清悬空对象，不加 `-a`。
- root 项逐项确认；非交互加 `--yes` 时用 `sudo -n`，没有免密权限就报告失败。

## 扫描

`scan` 列出 `$HOME` 中超过阈值（默认 500M）的最大 30 个文件和 30 个一级目录；`--min-size` 支持 `k`、`M`、`G`，`--top` 改条数。`build-scan` 查 `node_modules`、`target`、`build`、`dist`、`.venv` 并列出前 30 个。两者都只读。

## 退出码

| 码 | 含义 |
| -- | --- |
| 0 | 成功或预览完成 |
| 1 | 至少一项没完成：校验拒绝、删除失败、sudo 不可用 |
| 2 | 用法错误 |
| 3 | 用户取消 |
