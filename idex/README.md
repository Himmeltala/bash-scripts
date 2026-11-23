# idex

网页里的轻量级 IDE：浏览与编辑目录、预览图片、代码索引（定义、引用、重命名、悬停、诊断），并管理 SVN 工作副本与 Git 仓库的变更、日志与同步；Git 或 SVN 工作区探测到 Node 或 JVM 能力时，会多出对应引擎页签，用来扫描、启动与停止服务。

## 安装

在仓库根目录执行 `./install.sh`。运行时需要 `svn` 或 `git`。

## 用法

```
idex                 起网页界面，默认 8100
idex web             同上
```

| 选项 | 说明 |
| --- | --- |
| `--host 地址` | 默认 `0.0.0.0`；只想本机用 `127.0.0.1` |
| `-p, --port 端口` | 默认 8100 |
| `-o, --open` | 打开默认浏览器 |
| `--allow-write` | 允许其他机器发起写操作；默认只有本机能写 |
| `--json` | 只打一行地址给脚本用 |

页面没有登录，默认绑所有网卡；写操作默认只接受本机请求，加 `--allow-write` 才放开。

## 工作副本

左侧「添加」选择含 `.svn` 的目录或 Git 仓库目录。Git 可以登记仓库的子目录，只显示该目录下的改动与提交。工作区右键可设别名、复制路径、移除登记；移除只清登记，不动磁盘。

## 页面

- **变更**：列出未提交的改动，点一行看差异。Git 可暂存、取消暂存、把冲突标记为已解决；SVN 可纳管新增文件，或撤回刚纳入、还没提交的新增。
- **同步**：Git 的切换分支、拉取、推送、提交，SVN 的更新与提交。任务在服务端后台跑，关页面不中断，重新打开能接上，也可以取消。
- **提交日志**：列出最近的提交，选中后看改动路径与差异；Git 还显示分支时间线与领先、落后远端的数量。
- **浏览目录**：左侧文件树，右侧编辑器，带行号、语法高亮、页签与未保存草稿。Git 仓库里，行号左侧标出新增、修改、删除；点标记看这一块原文，可以只还原这一块。右键可新建、重命名、删除；已纳入版本控制的条目走 `git mv`、`svn mv` 等，保住历史。
- **代码索引**：按住 Ctrl 点标识符跳到定义，右键可查找引用、重命名、复制标识符；Ctrl+P 快速打开文件，Ctrl+Shift+O 看符号大纲，Ctrl+I 看悬停，Ctrl+G 跳到指定行。
- **图片**：`png`、`jpg`、`jpeg`、`gif`、`webp`、`bmp`、`ico`、`svg`、`avif` 直接预览；`svg` 可切回编辑器改源码。超过 512KB 的文本文件给下载入口。

搜索默认跳过 `.git`、`.svn`、`.hg`、`node_modules`、`__pycache__`、`dist`、`build`、`target`，名单在右上角设置里改。

Git 与 SVN 的认证走 credential helper、ssh-agent 或已缓存凭据，页面不弹密码；先在终端完成一次登录。

## 代码索引依赖

本机先装语言服务器：

```bash
npm i -g bash-language-server
npm i -g pyright
npm i -g typescript typescript-language-server
npm i -g @vue/typescript-plugin @vue/language-server
```

Vue 的模板交给 `vue-language-server`，脚本与 tsserver 回问交给同一份 `typescript-language-server`；两样都要装。

Java 需要 Eclipse JDT LS，把 `jdtls` 放进 `PATH`，要求 Java 21 以上，较新的快照可能要 Java 25。缺哪个，设置页会列出来。

## 退出码

| 码 | 含义 |
| --- | --- |
| 0 | 成功 |
| 1 | 执行失败 |
| 2 | 用法错误、缺前端产物、`svn` 与 `git` 都没装，或缺 `python3` |
