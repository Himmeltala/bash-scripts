# bash-scripts

自用 bash 工具集合，按用途分目录存放。

```
bash-scripts/
├── install.sh                    安装
├── uninstall.sh                  卸载
├── bash-tui.ref                  依赖的 bash-tui 标签
├── lib/
│   ├── tui-path.sh               定位并加载 bash-tui
│   ├── shell-shared/             nodex、mvnx 共用的 shell 基础件（退出码、记录界面、网页状态与启动）
│   ├── web-shared/               四个网页界面共用的前端组件（本地 npm 包）
│   └── py-shared/                四个网页进程共用的 Python 骨架
├── mvnx/                     Maven 项目：发现模块与项目并执行 mvn
│   ├── README.md
│   ├── bin/
│   │   └── mvnx
│   └── lib/
│       ├── mvnx-core.sh      加载器
│       └── mvnx/             按职责拆的模块，commands/ 下每条命令一个文件
├── nodex/                       Node 项目：发现工作区里的包并启动、构建、装依赖
│   ├── README.md
│   ├── bin/
│   │   └── nodex
│   ├── lib/
│   │   ├── nodex-core.sh      加载器
│   │   └── nodex/             包扫描、界面、执行、网页服务与命令
│   ├── test/
│   │   └── run.sh             临时 Node 工作区下的回归测试
│   └── web/                   网页前端源码，打包产物进 lib/nodex/web/static
├── dvcsx/                      版本库：网页里看变更与日志，拉取、推送、更新与提交
│   ├── README.md
│   ├── bin/
│   │   └── dvcsx
│   ├── lib/
│   │   ├── dvcsx-core.sh      加载器
│   │   └── dvcsx/             命令行、网页服务与 SVN 查询
│   ├── test/
│   │   └── run.sh             临时 SVN 仓库下的回归测试
│   └── web/                   网页前端源码，打包产物进 lib/dvcsx/web/static
├── gradlex/                     Gradle 项目：发现可运行模块并启动或构建
│   ├── README.md
│   ├── bin/
│   │   └── gradlex
│   ├── lib/
│   │   ├── gradlex-core.sh   加载器
│   │   └── gradlex/          构建扫描、界面、执行与命令
│   └── test/
│       └── run.sh            临时 Gradle 工程下的回归测试
├── zipx/                         归档：压缩、解压、查看、包内增删
│   ├── README.md
│   ├── bin/
│   │   └── zipx
│   └── lib/
│       ├── zipx-core.sh          加载器
│       └── zipx/                 按职责拆的模块
├── portx/                        系统运维：按端口查询应用，-k 结束进程
│   ├── README.md
│   ├── bin/
│   │   └── portx
│   ├── lib/
│   │   ├── portx-core.sh         加载器
│   │   └── portx/                端口扫描、命令行与终端菜单
│   └── test/
│       └── run.sh                临时监听进程下的回归测试
├── cleanx/                       系统运维：清理缓存、日志与开发垃圾
│   ├── README.md
│   ├── bin/
│   │   └── cleanx
│   └── lib/
│       ├── cleanx-core.sh        加载器
│       └── cleanx/               注册表、三类清理项、执行器与界面
├── claudex/                      系统运维：管理 Claude Code 会话与缓存
│   ├── README.md
│   ├── bin/
│   │   └── claudex
│   ├── lib/
│   │   ├── claudex-core.sh       加载器
│   │   └── claudex/              会话扫描、归档动作、缓存与界面
│   └── test/
│       └── run.sh                临时 HOME 下的回归测试
└── tokx/                         用量统计：三个编码代理的 token 与费用
    ├── README.md
    ├── config.example.toml       价格与峰谷时段示例
    ├── bin/
    │   └── tokx                  入口：bash，负责菜单与分发
    ├── lib/
    │   ├── tokx-tui.sh           交互菜单
    │   └── tokx/                 配置、价格、三个数据源与报表
    └── test/
        └── run.sh                临时 HOME 下的回归测试
```

除共享的 `lib/` 外，仓库根目录下的每个目录就是一个工具，目录名与命令名一致：`mvnx`、`nodex`、`dvcsx`、`gradlex`、`zipx`、`portx`、`cleanx`、`claudex`、`tokx`。`tokx` 的采集、计价与出表用 Python 写，入口与菜单仍是 bash，界面因此与其他工具共用 `bash-tui`。工具目录里的 `bin/` 放可执行文件，`lib/` 放入口引用的库；安装时只软链 `bin/` 下的文件，`lib/` 不会出现在 PATH 里。加新工具就是新建一个同名目录。例外是 `lib/` 下不是工具的三层共用代码：`lib/web-shared/` 是四个网页界面（nodex、mvnx、dvcsx、tokx）共用的前端组件、工作区页面外壳、组合式函数与纯工具，做成本地 npm 包，改了源码要它自己 `npm run build` 出 `dist/`，四个工程按 `file:` 依赖引用，`vite.config.js` 也共用这里的配置工厂；`lib/py-shared/` 是四个网页进程共用的 Python 骨架（HTTP 路由、接口基类、启动流程、SSE、指标、状态行、文件与路径工具、行式存储），直接被 `server.py` 按路径加进 `sys.path` 后引用，不需要构建；`lib/shell-shared/` 是 nodex 与 mvnx 共用的 shell 基础件（退出码、记录勾选、网页状态文件与启动流程），由各自的 `*-core.sh` 按顺序 source。

## 安装

一行装完：

```bash
curl -fsSL https://cdn.jsdelivr.net/gh/Himmeltala/bash-scripts@main/install.sh | bash
```

装完重开 shell，让 PATH 生效。

安装脚本只在需要时才改 `~/.bashrc`。默认链接目录 `~/.local/bin` 在这台机器上已经被系统配置加进 PATH 时不写，只提示一句：

- Debian / Ubuntu 的 `~/.profile` 里有「`~/.local/bin` 存在就加进 PATH」那段，登录 shell 会读它。
- `/etc/environment` 里的 `PATH=` 已经包含链接目录时同样算已有设置。

两种都不满足（比如 `BASH_SCRIPTS_BIN_DIR` 指到了别处、`.profile` 没有那段、或者不是 Debian 系）才写 `.bashrc`，写入的是带 `# bash-scripts 装的工具` 标记的两行，卸载时按标记摘掉。

也可以先 clone 仓库再安装，适合要改源码的情形：

```bash
git clone git@github.com:Himmeltala/bash-scripts.git
cd bash-scripts
./install.sh
```

## 依赖 bash-tui

界面组件来自独立仓库 `Himmeltala/bash-tui`，版本固定在 `bash-tui.ref`。

- 本地开发时，把 `bash-scripts` 与 `bash-tui` 放在同一父目录，加载器就会直接使用同级检出。
- 安装时优先复制同级检出；没有同级检出时，按 `bash-tui.ref` 的标签下载归档。
- 安装后依赖位于 `~/.local/share/bash-scripts/vendor/bash-tui`。
- 也可以用 `BASH_TUI_DIR` 显式指定依赖目录。

### 重复安装

再跑一次 `install.sh` 等价于「先卸载再安装」。脚本先删掉链接目录里指向安装目录的软链，再删掉安装目录，然后摘掉 `.bashrc` 里那段 PATH 设置；之后重新拷贝一份源码、重新创建链接，再按上面的规则决定要不要重新写 PATH 设置。

这么做是因为安装脚本只加不删：工具改名或换目录结构之后，旧目录会一直留在安装目录里，链接目录里还会留下指向已删路径的死链。卸载脚本的逻辑与这里一致，区别只是那边多一个 `--dry-run` 与 `--keep-path`。

两条注意：

- 安装目录是仓库的镜像，不要直接改那边的文件，否则下次安装会把改动整个清掉。
- 安装目录可以由 `BASH_SCRIPTS_INSTALL_DIR` 指到别处。清理之前，脚本会确认那个目录里装的确实是本项目的东西（目录名是 `bash-scripts`，或者里面有带 `bin` 的工具目录），对不上就报错退出，不会删。

### 安装地址说明

用 jsDelivr 的 CDN 地址，是因为部分网络访问不到 `raw.githubusercontent.com`，直连会超时。仓库里文件的规范地址是：

```
https://raw.githubusercontent.com/Himmeltala/bash-scripts/main/install.sh
```

网络通的时候，用哪条都行。jsDelivr 对分支引用有缓存；如果要固定到某个版本，可以把 `@main` 换成具体的提交哈希。

安装脚本内部下载仓库归档时走的是 `codeload.github.com`，与上面两条地址属于不同域名。如果这个域名也不通，就用环境变量 `BASH_SCRIPTS_TARBALL_URL` 换成别的地址，或者先 clone 再本地安装。

## 界面约定

菜单与勾选的每一项都由「标签」与「说明」组成，两种模式画出来的东西不一样：

- 终端界面画主文本与次要文本，标签只用来回传选中结果，不显示。
- 编号回退画标签与说明，标签本身就是名字。

命令菜单（`pack`、`clean`、`quit` 这类关键词）用 bash-tui 的 `ui_menu_named`：界面上主文本写命令名，小字写对命令名的解释。数据列表（包名、会话标题、归档）仍用 `ui_menu`，主文本写数据本身。名字与标签相同的勾选项用 `ui_item_text` 拼文本，两种模式下名字都可见且不重复。

界面之外的东西不再各写一份：终端探测、暂停等键、空选当成功、同名标签去重、勾选记忆都由 bash-tui 提供，见 [bash-tui 的组件文档](https://github.com/Himmeltala/bash-tui/blob/main/docs/components.md)。

## 卸载

```bash
curl -fsSL https://cdn.jsdelivr.net/gh/Himmeltala/bash-scripts@main/uninstall.sh | bash
```

clone 过仓库的，可以直接跑 `./uninstall.sh`。两个常用开关：

```bash
./uninstall.sh --dry-run     只打印要删什么，不会真的删除
./uninstall.sh --keep-path   保留 ~/.bashrc 里的 PATH 设置
```

卸载只清自己装进去的东西：指向本项目源码目录的软链、源码目录，以及带 `# bash-scripts 装的工具` 标记的那段 PATH 设置（安装时没写就没有可摘的）。链接目录里不是本项目的文件一律不碰。

## 装到哪里

```
~/.local/share/bash-scripts/     源码，目录结构与仓库一致
~/.local/bin/mvnx                软链，指向源码目录里 mvnx/bin/ 下的可执行文件
```

源码树里每个 `*/bin/` 下的可执行文件都会软链到链接目录，各工具目录的 `lib/` 不会被软链。

两个位置都遵循 XDG 规范，也都可以用环境变量覆盖：

| 变量 | 默认值 |
| --- | --- |
| `BASH_SCRIPTS_INSTALL_DIR` | `${XDG_DATA_HOME:-~/.local/share}/bash-scripts` |
| `BASH_SCRIPTS_BIN_DIR` | `~/.local/bin` |
| `BASH_SCRIPTS_TARBALL_URL` | 仓库 main 分支的归档地址 |
| `BASH_SCRIPTS_ENVIRONMENT` | 核对 PATH 用的系统配置文件，默认 `/etc/environment` |

## 工具清单

| 命令 | 目录 | 说明 |
| --- | --- | --- |
| `mvnx` | mvnx | 递归发现 Maven 模块与项目，勾选后执行 `spring-boot:run`、`clean install` 或 `clean package`；不带参数时先选命令再选目标，启动方式有自动判定、强制编译、跳过编译、先 clean 四种 |
| `dvcsx` | dvcsx | 网页里看 SVN 工作副本或 Git 仓库：变更按类型列出、点文件看差异，提交日志带分支时间线；也能拉取、推送、切换分支、更新与提交，并浏览、编辑工作副本里的文件 |
| `gradlex` | gradlex | 递归发现 Gradle 构建与可运行模块，勾选后执行 `bootRun` 或 `run`，或者 `bootJar` 或 `assemble`；支持 `--rebuild` 与 `--refresh`，自动选 wrapper 或系统 Gradle |
| `zipx` | zipx | 压缩、解压、查看校验、包内增删四类操作收在一个菜单里，勾选目标；只管 zip，默认排除 `.git`、`target`、`node_modules` 等，不静默覆盖已有包 |
| `portx` | portx | 按端口查询占用它的应用与进程，或浏览当前监听端口；默认只读，加 `-k` 才结束进程，系统级端口需 `--force`；不带参数进入终端菜单 |
| `cleanx` | cleanx | 清理用户缓存、回收站、系统包缓存与日志、开发缓存，另带大文件与构建产物扫描；默认只预览，加了 `--yes` 才会删除，需要 root 的项用 sudo 逐项确认 |
| `claudex` | claudex | 管理 Claude Code 会话：列表、继续、归档、恢复归档、永久删除，另清旧快照、孤儿数据与插件缓存；归档与删除默认只预览，运行中的会话受保护 |
| `tokx` | tokx | 统计 Claude Code、opencode、DeepSeek Harness 的 token 用量，按 DeepSeek 峰谷价与 mimo 实时价折算费用；不带参数时进菜单选报表、统计范围与来源，报表按天、按会话或按小时汇总 |

各工具的详细用法见对应目录下的 README。

## 环境要求

需要 bash 4 以上。`mvnx` 还需要 Maven 在 PATH 里。`dvcsx`、`nodex`、`mvnx` 与 `tokx` 都有网页界面，需要 Python 3.7 以上（`tokx` 的统计部分要 3.11），前端产物随仓库提供；`dvcsx` 另需 `svn` 或 `git` 在 PATH 里。`gradlex` 需要 Gradle 在 PATH 里，或项目自带 `gradlew`；`GRADLEX_GRADLE` 可强制指定入口。`mvnx`、`gradlex`、`zipx`、`portx`、`cleanx`、`claudex` 与 `tokx` 的界面都在终端里自绘，探不到终端时退回编号输入。`tokx` 的统计部分用 Python 3.11 以上，读 DeepSeek Harness 的会话日志需要 `zstd`。`zipx` 需要 `zip` 与 `unzip`，缺失时启动就报错。`portx` 需要 `ss`（iproute2）或 `lsof`，两者都没有时会报错退出。`cleanx` 需要 GNU `du`、`find` 与 `realpath`；系统类清理需要 `sudo`，`sys.journal` 需要 `journalctl`，`sys.tmp` 需要 `systemd-tmpfiles`。`claudex` 需要 GNU `stat`、`du`、`find` 与 `truncate`，继续会话需要 `claude` 在 PATH 里。
