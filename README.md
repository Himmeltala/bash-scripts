# bash-scripts

自用的命令行与网页工具集合，一个目录一个命令：`bin/` 放可执行文件，`lib/` 放实现与共享代码。

| 命令 | 说明 |
| --- | --- |
| `mvnx` | 发现 Maven 模块，启动、安装或打包 |
| `gradlex` | 发现 Gradle 构建，启动或构建 |
| `idex` | 网页里的轻量级 IDE，带 SVN / Git 变更管理与 Node、JVM 引擎 |
| `llmx` | 统计 Claude Code、opencode、DeepSeek Harness 的 token 用量与费用 |
| `netx` | 旁路记录出网连接与明文内容 |
| `zipx` | 压缩、解压、校验、包内增删 |
| `portx` | 查端口占用与监听端口 |

网页工具默认端口：`llmx` 8000、`idex` 8100、`netx` 8400。

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

装完重开 shell。重复执行 `install.sh` 等于先卸载再安装：源码放置到 `~/.local/share/bash-scripts`，各工具的可执行文件软链到 `~/.local/bin`，需要时再往 `~/.bashrc` 写带标记的 PATH 设置。

安装目录可用 `BASH_SCRIPTS_INSTALL_DIR` 与 `BASH_SCRIPTS_BIN_DIR` 覆盖。

## 卸载

```bash
curl -fsSL https://cdn.jsdelivr.net/gh/Himmeltala/bash-scripts@main/uninstall.sh | bash
```

clone 过的直接跑 `./uninstall.sh`；`--dry-run` 只打印不删，`--keep-path` 保留 PATH 设置。

## 外部依赖

`mvnx` 需要 Maven 或 `./mvnw`；`gradlex` 需要 Gradle 或 `gradlew`；`idex` 需要 `svn` 或 `git`，Node 引擎需要 `node` 与 `npm`、`pnpm`、`yarn` 之一，JVM 引擎需要 `mvnx` 或 `gradlex`；`llmx` 读 DeepSeek Harness 日志需要 `zstd`；`netx` 采集需要 `bpftrace` 与 root；`zipx` 需要 `zip` 与 `unzip`；`portx` 需要 `ss` 或 `lsof`。
