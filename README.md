# bash-scripts

自用 bash 工具集合，按工作流分层存放。

```
bash-scripts/
├── install.sh                    安装
├── uninstall.sh                  卸载
└── workflows/
    └── java-maven/               Java Maven 工作流
        ├── README.md
        └── bin/
            └── mvnstart
```

`workflows/` 下每一层目录代表一类工作流，`bin/` 里放该工作流的可执行文件；以后加别的领域的工具，另起一个目录即可：

```
workflows/
├── java-maven/
├── mysql/          以后放数据库相关的
└── svn/            以后放版本控制相关的
```

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
~/.local/bin/mvnstart            软链，指向上面的 bin/mvnstart
```

两个位置都遵循 XDG 规范，可用环境变量覆盖：

| 变量 | 默认值 |
| --- | --- |
| `BASH_SCRIPTS_INSTALL_DIR` | `${XDG_DATA_HOME:-~/.local/share}/bash-scripts` |
| `BASH_SCRIPTS_BIN_DIR` | `~/.local/bin` |
| `BASH_SCRIPTS_TARBALL_URL` | 仓库 main 分支的归档地址 |

## 工具清单

| 命令 | 工作流 | 说明 |
| --- | --- | --- |
| `mvnstart` | java-maven | 递归发现 Maven 模块与项目，勾选后执行 `spring-boot:run` 或 `clean install` |

各工具的详细用法见对应工作流目录下的 README。

## 环境要求

bash 4 以上。`mvnstart` 额外需要 Maven 在 PATH 里；有 whiptail 时用图形化复选清单，没有就退回编号输入。
