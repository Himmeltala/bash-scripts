# bash-scripts

命令行与网页工具集合。一个目录一个命令：`bin/` 放可执行文件，`lib/` 放实现与共享代码。

| 命令 | 用途 |
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

需要 bash 4 以上；网页工具需要 Python 3.7 以上（`llmx` 要 3.11）；构建前端需要 Node 与 npm。

```bash
curl -fsSL https://cdn.jsdelivr.net/gh/Himmeltala/bash-scripts@main/install.sh | bash
```

或先 clone：

```bash
git clone git@github.com:Himmeltala/bash-scripts.git
cd bash-scripts
./install.sh
```

装完重开 shell。重复执行 `install.sh` 会先卸载再安装；源码放在 `~/.local/share/bash-scripts`，可执行文件软链到 `~/.local/bin`，必要时往 `~/.bashrc` 写 PATH。`BASH_SCRIPTS_INSTALL_DIR`、`BASH_SCRIPTS_BIN_DIR` 可改这两个位置。

可选依赖单独装，不在正常安装里：

```bash
./install.sh --list-deps
./install.sh --deps libreoffice     # 例如 Office 预览用的 LibreOffice
./install.sh --deps all
```

管道方式：`curl -fsSL https://cdn.jsdelivr.net/gh/Himmeltala/bash-scripts@main/install.sh | bash -s -- --deps libreoffice`。新增依赖的写法见 `install/README.md`。

## 卸载

```bash
curl -fsSL https://cdn.jsdelivr.net/gh/Himmeltala/bash-scripts@main/uninstall.sh | bash
```

clone 过的直接跑 `./uninstall.sh`；`--dry-run` 只打印，`--keep-path` 保留 PATH 设置。

## 开发模式

```bash
./dev.sh idex                        # 只允许本机
DEV_HOST=0.0.0.0 ./dev.sh idex       # 同一网络可访问
```

可选 `llmx`、`netx`。后端跑仓库里的源码，Vite 起前端并代理接口；前端改动热更新，Python 改动自动重启后端。首次运行会装依赖，缺静态产物时构建一次。

默认端口：`idex` 5173/8771，`llmx` 5174/8770，`netx` 5175/8400。`DEV_HOST` 同时决定前后端绑定地址（默认 `127.0.0.1`）；`DEV_VITE_PORT`、`DEV_BACKEND_PORT` 可换端口。

## 外部依赖

`mvnx` 需要 Maven 或 `./mvnw`；`gradlex` 需要 Gradle 或 `gradlew`；`idex` 需要 `svn` 或 `git`，Node 引擎需要 `node` 与 `npm`，JVM 引擎需要 `mvnx` 或 `gradlex`，Office 预览需要 `libreoffice`（writer/calc/impress）；`llmx` 读 DeepSeek Harness 日志需要 `zstd`；`netx` 采集需要 `bpftrace` 与 root；`zipx` 需要 `zip` 与 `unzip`；`portx` 需要 `ss` 或 `lsof`。
