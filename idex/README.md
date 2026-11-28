# idex

网页里的轻量级 IDE：浏览与编辑目录、预览图片与表格、代码索引（定义、引用、重命名、悬停、诊断），管理 SVN / Git 的变更、日志与同步。工作区探测到 Node 或 JVM 能力时多出对应引擎页签。

## 安装

仓库根目录执行 `./install.sh`。运行时需要 `svn` 或 `git`。

## 用法

```
idex          起网页界面，默认 8100
idex web      同上
```

| 选项 | 说明 |
| --- | --- |
| `--host 地址` | 默认 `0.0.0.0`；只给本机用 `127.0.0.1` |
| `-p, --port 端口` | 默认 8100 |
| `-o, --open` | 打开默认浏览器 |
| `--allow-write` | 允许其他机器发起写操作；默认只有本机能写 |
| `--json` | 只打一行地址给脚本用 |

页面没有登录；默认绑所有网卡，写操作默认只接受本机请求。

## 工作副本

左侧「添加」选择含 `.svn` 的目录或 Git 仓库目录。Git 可登记仓库子目录，只看该目录下的改动与提交。工作区右键可设别名、复制路径、移除登记；移除只清登记，不动磁盘。

## 页面

- **源代码管理**：分支与领先/落后数量，切换分支、拉取、推送、更新；未提交改动与差异。Git 可暂存、取消暂存、标记冲突已解决；SVN 可纳管新增、撤回未提交的新增。填写说明后提交。
- **提交记录**：最近提交与改动路径、差异；Git 还显示分支时间线与领先/落后远端数量。
- **资源管理器**：文件树 + 编辑器，行号、语法高亮、页签、未保存草稿。Git 仓库行号左侧标新增/修改/删除，点标记看原文并可按块还原。右键新建、重命名、删除（已纳管的走 `git mv`、`svn mv`）；目录可压缩为 zip，包落在同级。Markdown 默认源码/渲染双栏，分隔条可拖动、双击还原；右上角可在源码、视图、双栏之间切换。
- **Node**：扫描 `package.json` 脚本，按启动、打包、安装分类；可启动、停止、看日志，选 Node 版本或加自定义命令。
- **JVM**：识别 Maven 与 Gradle 工程，扫描模块与目标；启动、停止、重启并看日志。
- **代码索引**：Ctrl 点标识符跳定义；右键查找引用、重命名、复制标识符；Ctrl+P 快速打开，Ctrl+Shift+O 符号大纲，Ctrl+I 悬停，Ctrl+G 跳行。
- **图片**：`png`、`jpg`、`jpeg`、`gif`、`webp`、`bmp`、`ico`、`svg`、`avif` 直接预览；`svg` 可切回源码。超过 512KB 的文本给下载入口。
- **Office**：`doc`、`docx`、`xls`、`xlsx`、`xlsm`、`ppt`、`pptx`、`pdf` 以只读 PDF 预览；PDF 直接显示，其余由本机 LibreOffice 转换，首次几秒、之后走缓存。动画与切换效果不保留。缺 LibreOffice 时预览报错，装：`./install.sh --deps libreoffice`。

搜索默认跳过 `.git`、`.svn`、`.hg`、`node_modules`、`__pycache__`、`dist`、`build`、`target`，名单在设置里改。

Git 与 SVN 认证走 credential helper、ssh-agent 或已缓存凭据，页面不弹密码；先在终端登录一次。

## 代码索引依赖

```bash
npm i -g bash-language-server
npm i -g pyright
npm i -g typescript typescript-language-server
npm i -g @vue/typescript-plugin @vue/language-server
```

Vue 模板交给 `vue-language-server`，脚本与 tsserver 回问交给同一份 `typescript-language-server`，两样都要装。Java 需要 Eclipse JDT LS，把 `jdtls` 放进 `PATH`，Java 21 以上（较新的快照可能要 Java 25）。缺哪个，设置页会列出来。

## 退出码

| 码 | 含义 |
| --- | --- |
| 0 | 成功 |
| 1 | 执行失败 |
| 2 | 用法错误、缺前端产物、`svn` 与 `git` 都没装，或缺 `python3` |

## 工程目录

前后端目录与文件放置约定见 [docs/工程目录约定.md](docs/工程目录约定.md)。
