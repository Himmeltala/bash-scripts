# bash-scripts

自用的 bash 工具集合，一个目录一个命令；`bin/` 放可执行文件，`lib/` 放实现，安装时只软链 `bin/`。

| 命令 | 说明 |
| --- | --- |
| `mvnx` | 发现 Maven 模块并执行 `spring-boot:run`、`clean install` 或 `clean package` |
| `dvcsx` | 网页里查看与操作 SVN / Git 工作副本：变更、差异、日志、拉取推送、切换分支、更新提交、浏览编辑文件 |
| `nodex` | 网页里管理 Node 工作区、启停脚本、选 Node 版本、看日志与指标 |
| `llmx` | 统计 Claude Code、opencode、DeepSeek Harness 的 token 用量并折算费用 |
| `gradlex` | 发现 Gradle 构建并执行 `bootRun`、`run`、`bootJar` 或 `assemble` |
| `zipx` | 压缩、解压、校验、包内增删，只管 zip |
| `portx` | 按端口查占用或浏览监听端口，`-k` 才结束进程 |
| `cleanx` | 清理缓存、回收站、系统日志与构建产物，默认只预览 |
| `claudex` | 管理 Claude Code 会话：列表、继续、归档、删除、清理旧数据 |

各工具的详细用法见对应目录下的 README。四个网页工具的默认端口：`llmx` 8000、`dvcsx` 8100、`nodex` 8200、`mvnx` 8300。

## 安装

需要 bash 4 以上；网页工具需要 Python 3.7 以上（`llmx` 要 3.11）；安装时用 Node 与 npm 构建前端。

```bash
curl -fsSL https://cdn.jsdelivr.net/gh/Himmeltala/bash-scripts@main/install.sh | bash
```

或者先 clone 再装：

```bash
git clone git@github.com:Himmeltala/bash-scripts.git
cd bash-scripts
./install.sh
```

装完重开 shell。重复执行 `install.sh` 等于先卸载再安装：源码复制到 `~/.local/share/bash-scripts`，各工具 `bin/` 下的可执行文件软链到 `~/.local/bin`，需要时再往 `~/.bashrc` 写带 `# bash-scripts 装的工具` 标记的 PATH 设置。安装目录是仓库镜像，不要直接改。

可用环境变量覆盖：

| 变量 | 默认值 |
| --- | --- |
| `BASH_SCRIPTS_INSTALL_DIR` | `${XDG_DATA_HOME:-~/.local/share}/bash-scripts` |
| `BASH_SCRIPTS_BIN_DIR` | `~/.local/bin` |
| `BASH_SCRIPTS_TARBALL_URL` | 仓库 main 分支的归档地址 |
| `BASH_SCRIPTS_ENVIRONMENT` | 核对 PATH 用的系统配置文件，默认 `/etc/environment` |

界面组件来自 `Himmeltala/bash-tui`，版本固定在 `bash-tui.ref`：安装时优先用同级检出，没有就按标签下载到 `vendor/bash-tui`；`BASH_TUI_DIR` 可显式指定。

## 卸载

```bash
curl -fsSL https://cdn.jsdelivr.net/gh/Himmeltala/bash-scripts@main/uninstall.sh | bash
```

clone 过的直接跑 `./uninstall.sh`；`--dry-run` 只打印不删，`--keep-path` 保留 PATH 设置。只清本项目的软链、源码目录和带标记的 PATH 段。

## 环境要求

`mvnx` 需要 Maven 或 `./mvnw`；`dvcsx` 需要 `svn` 或 `git`；`gradlex` 需要 Gradle 或 `gradlew`，`GRADLEX_GRADLE` 可指定入口；`llmx` 需要 `zstd` 读 DeepSeek Harness 日志；`zipx` 需要 `zip` 与 `unzip`；`portx` 需要 `ss` 或 `lsof`；`cleanx` 需要 GNU `du`、`find`、`realpath`；`claudex` 需要 GNU `stat`、`du`、`find`、`truncate`，继续会话需要 `claude`。终端界面探不到终端时自动退回编号输入。
