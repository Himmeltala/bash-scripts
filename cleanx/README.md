# cleanx

Linux 家目录与系统垃圾清理工具，按用户缓存、系统包与日志、开发缓存三类执行清理，另带大文件与构建产物扫描。不带参数时打开菜单；带参数时默认只预览清单与大小，加 `--yes` 才真正删除。

## 用法

```
cleanx                         打开菜单，逐类勾选后确认清理
cleanx user                    预览用户缓存与回收站的默认清理项
cleanx user --yes              真正执行用户类清理
cleanx user user.trash --yes   只清回收站
cleanx system                  预览系统类清理，命令带 sudo 但不执行
cleanx dev --yes               清理开发缓存的默认项
cleanx scan                    扫描家目录大文件，只报告
cleanx scan --min-size 1G --top 50
cleanx build-scan              扫描 node_modules、target 等构建产物目录，只报告
cleanx list                    列出全部清理项编号与可用状态
cleanx list dev                只列开发类的清理项
cleanx -n dev --yes            预览优先，不执行
cleanx --help                  显示帮助
```

菜单里用方向键移动、空格勾选、回车确认、`q` 退出。探不到终端时退回编号输入：菜单输入一个编号，复选输入多个编号，用空格分隔。

## 默认行为

- 不带类别时进菜单，勾选后还有一次确认框，确认才删。
- 带类别时默认只预览：打印每一项的大小与将执行的命令，不动盘。加 `--yes` 才删除；`-n` 优先级高于 `--yes`，用来强制预览。
- 不写清理项编号时，执行该类别里默认勾选的项。指定编号时按给定顺序执行，默认不勾选的项也可以显式选中。
- 带类别时，非交互环境（标准输入不是终端）必须加 `--yes` 才删除；菜单模式无论有没有终端都要经过确认框。需要 root 的项在非交互且加了 `--yes` 时改用 `sudo -n`，没有免密权限就报告失败，不会挂起等密码。

## 清理项

| 编号 | 类别 | 说明 | 默认 |
| --- | --- | --- | --- |
| `user.thumbnails` | user | `~/.cache/thumbnails`，缩略图缓存 | 勾选 |
| `user.fontconfig` | user | `~/.cache/fontconfig`，字体索引缓存 | 勾选 |
| `user.browser` | user | Firefox 与 Chrome 系网页缓存，建议先关浏览器 | 不勾选 |
| `user.trash` | user | 清空回收站，文件与 `.trashinfo` 一并删除 | 勾选 |
| `sys.apt` | system | `apt-get clean`，清 `/var/cache/apt/archives` | 勾选 |
| `sys.journal` | system | `journalctl --vacuum-time=14d`，保留 14 天 | 勾选 |
| `sys.tmp` | system | `systemd-tmpfiles --clean`，按发行版规则清 `/tmp` | 不勾选 |
| `dev.maven` | dev | `~/.m2/repository` | 勾选 |
| `dev.gradle` | dev | `~/.gradle/caches` | 勾选 |
| `dev.npm` | dev | `~/.npm/_cacache` | 勾选 |
| `dev.yarn` | dev | `~/.cache/yarn` | 勾选 |
| `dev.pnpm` | dev | `~/.local/share/pnpm/store` | 勾选 |
| `dev.pip` | dev | `~/.cache/pip` | 勾选 |
| `dev.go` | dev | `~/.cache/go-build` 与 `~/go/pkg/mod` | 勾选 |
| `dev.cargo` | dev | `~/.cargo/registry` 下的下载缓存与解包源码 | 勾选 |
| `dev.ide` | dev | JetBrains 与 VS Code 的缓存，建议先关 IDE | 不勾选 |
| `dev.docker` | dev | 悬空镜像与构建缓存，需要 docker 与 sudo | 勾选 |

路径不存在的项不会出现在菜单与默认清单里，`cleanx list` 里标为「不适用」。

## 安全约定

- **路径只在家目录以内。** 每一条路径删除前都要解析成真实路径，仍在家目录之外的直接拒绝；`$HOME` 本身、`/` 与含 `..` 的路径也拒绝。
- **符号链接不跟随。** 撞上符号链接的路径项直接跳过并报原因，避免顺链接删到家目录之外。
- **挂载点只清内容。** `~/.cache` 等目录如果是独立挂载点，只删里面的内容，不删挂载点本身。
- **回收站成对删除。** `files` 与 `info` 两个目录一起清，避免回收站里留下没有文件的 `.trashinfo`。
- **系统类不自己拼删除命令。** apt 用 `apt-get clean`，日志用 `journalctl --vacuum-time`，`/tmp` 用 `systemd-tmpfiles --clean`，行为与系统自带规则一致。
- **Docker 只清悬空对象。** 执行 `docker image prune -f` 与 `docker builder prune -f`，不加 `-a`，不动正在使用的镜像。
- **root 项逐项确认。** 菜单里每一项需要 sudo 的操作单独询问一次；`--yes` 视为已经确认。预览模式只打印 `sudo` 命令，不弹密码。

## 扫描报告

`scan` 扫描 `$HOME`，列出大于阈值（默认 500M）的文件中最大的 30 个，以及最大的 30 个一级目录。`--min-size` 支持 `k`、`M`、`G`，只给数字时按字节算；`--top` 改条数。扫描只读，不删任何东西。

`build-scan` 查找 `node_modules`、`target`、`build`、`dist`、`.venv` 这几类目录，按大小列出前 30 个，同样只报告。家目录大、项目多时扫描较慢，这是预期行为。

## 退出码

| 码 | 含义 |
| --- | --- |
| 0 | 成功，或预览完成 |
| 1 | 至少有一项没完成：路径校验拒绝、删除失败、sudo 不可用 |
| 2 | 用法错误 |
| 3 | 用户取消 |

## 已知限制

- 只支持 Linux，路径大小依赖 GNU `du -sb` 与 GNU `find -printf`。
- 路径类清理项只动家目录以内；`~/.cache` 如果是指向家目录外的符号链接，会被安全校验拒绝。
- `/var/log` 下的普通文件、发行版包管理器以外的缓存不在范围内。
- `apt autoremove` 会卸载软件包，不属于清理范围，本工具不执行。
- 系统日志固定保留 14 天，没有开放参数。
- 没有配置文件。新增清理项要在 `lib/cleanx/items-*.sh` 里注册，这样做是为了让所有可删路径都经过同一套安全校验。

## 实现说明

- 清理项是注册表里的数据：编号、类别、标题、说明、类型、路径或函数、测量函数、是否需要 root、默认是否勾选。执行器只管测量、确认、校验、执行与统计，不认具体工具。
- `path` 类型按 `du -sb` 测量；`func` 类型用专用测量函数，测不到时显示「大小未知」，不影响执行。执行完成后再测一次，用前后差值统计释放量。
- 界面能不能用，必须在命令替换之外判断一次并写进 `UI_MODE`。界面函数的输出走标准输出，被 `$(...)` 接走；在替换里判断终端会把界面一直退化成编号输入。
- 预览与真正执行走同一个执行出口 `run_cmd`，预览只打印命令、返回成功，所以清理函数不需要自己判断模式。
