# bash-scripts

自用 bash 工具集合，按用途分目录存放。

```
bash-scripts/
├── install.sh                    安装
├── uninstall.sh                  卸载
├── archive/                      归档类工具
│   ├── README.md
│   ├── bin/
│   │   └── zipx
│   └── lib/
│       ├── zipx-core.sh          加载器
│       └── zipx/                 按职责拆的模块
├── maven/                        Maven 类工具
│   ├── README.md
│   ├── bin/
│   │   └── mvnstart
│   └── lib/
│       ├── mvnstart-core.sh      加载器
│       └── mvnstart/             按职责拆的模块，commands/ 下每条命令一个文件
├── mysql/                        以后放数据库相关的
├── svn/                          以后放版本控制相关的
└── system/                       系统运维类工具
    ├── README.md
    └── bin/
        └── killport
```

根下每个目录代表一类工具，`bin/` 里放可执行文件，`lib/` 放被入口共用的库，不会被软链成命令。工具的划分按用途走，不按语言或技术：`archive` 管归档，`maven` 管 Maven 项目，`system` 管系统运维。加新工具就是新建一个这样的目录。

## 安装

一行装完：

```bash
curl -fsSL https://cdn.jsdelivr.net/gh/Himmeltala/bash-scripts@main/install.sh | bash
```

装完重开 shell，或执行 `source ~/.bashrc` 让 PATH 生效。

也可以先 clone 再跑，适合要改源码的情形：

```bash
git clone git@github.com:Himmeltala/bash-scripts.git
cd bash-scripts
./install.sh
```

### 安装地址说明

用 jsDelivr 的 CDN 地址，是因为某些网络（含国内多数宽带）访问不到 `raw.githubusercontent.com`，直连会超时。仓库里文件的规范地址是：

```
https://raw.githubusercontent.com/Himmeltala/bash-scripts/main/install.sh
```

网络通的话用哪条都行。jsDelivr 对分支引用有缓存，想固定到某个版本可以把 `@main` 换成具体的提交哈希。

安装脚本内部下载仓库归档走的是 `codeload.github.com`，与上面两条是不同域名；要是这个域名也不通，用环境变量 `BASH_SCRIPTS_TARBALL_URL` 换成别的地址，或者直接 clone 后本地安装。

## 卸载

```bash
curl -fsSL https://cdn.jsdelivr.net/gh/Himmeltala/bash-scripts@main/uninstall.sh | bash
```

clone 过的可以直接跑 `./uninstall.sh`。两个常用开关：

```bash
./uninstall.sh --dry-run     只打印要删什么，不动盘
./uninstall.sh --keep-path   保留 ~/.bashrc 里的 PATH 设置
```

卸载只清自己装进去的东西：指向本项目源码目录的软链、源码目录、以及带 `# bash-scripts 装的工具` 标记的那段 PATH 设置。链接目录里不是本项目的文件一律不碰。

## 装到哪里

```
~/.local/share/bash-scripts/     源码，目录结构与仓库一致
~/.local/bin/mvnstart            软链，指向上面的 maven/bin/ 里的可执行文件
```

源码树里每个 `*/bin/` 下的可执行文件都会软链到链接目录，各工具目录的 `lib/` 不链。

两个位置都遵循 XDG 规范，可用环境变量覆盖：

| 变量 | 默认值 |
| --- | --- |
| `BASH_SCRIPTS_INSTALL_DIR` | `${XDG_DATA_HOME:-~/.local/share}/bash-scripts` |
| `BASH_SCRIPTS_BIN_DIR` | `~/.local/bin` |
| `BASH_SCRIPTS_TARBALL_URL` | 仓库 main 分支的归档地址 |

## 工具清单

| 命令 | 所属目录 | 说明 |
| --- | --- | --- |
| `mvnstart` | maven | 递归发现 Maven 模块与项目，勾选后执行 `spring-boot:run`、`clean install` 或 `clean package`；不带参数先选命令再选目标，启动方式分自动跳过编译、强制编译、跳过编译、先 clean 四种 |
| `killport` | system | 输入端口，杀掉占用它的进程；先 SIGTERM 再按需补 SIGKILL，系统级端口默认拒绝，要 `--force` 才动 |
| `zipx` | archive | 压缩、解压、查看校验、包内增删四类操作收在一个菜单里，勾选目标；只管 zip，默认排除 `.git`、`target`、`node_modules` 等，不静默覆盖已有包 |

各工具的详细用法见对应目录下的 README。

## 环境要求

bash 4 以上。`mvnstart` 额外需要 Maven 在 PATH 里；有 whiptail 时用图形化复选清单，没有就退回编号输入。`killport` 需要 `ss`（iproute2）或 `lsof`，两者都没有时会报错退出。`zipx` 需要 `zip` 与 `unzip`，缺失时启动就报错。
