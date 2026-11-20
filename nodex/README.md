# nodex

在 Node 工作区里选脚本执行，省去手敲 `pnpm --filter <目录> run dev`。

## 安装

在仓库根目录执行 `./install.sh`。网页模式需要 Node 与 npm。

## 用法

```
nodex                 先选命令，再勾脚本
nodex dev|build|install
nodex dev web         按关键词跳过勾选，直接跑名字带 web 的脚本
nodex --list          只列出目标；默认按 dev 列
nodex --refresh       清掉当前命令的勾选记录
nodex web             起网页界面，默认 8200
```

| 命令 | 目标 | 执行 |
| --- | --- | --- |
| `dev` | 有 `dev`、`start`、`serve` 或冒号变体 | `<包管理器> run <脚本>` |
| `build` | 有 `build` 或 `build:` 变体 | `<包管理器> run build` |
| `install` | 工作区根与所有子目录 | 根跑 `npm install`，子目录跑 `npm install --workspace <名称>` |

扫描从当前目录向上找最近的 `package.json`，成员来自 `workspaces` 字段或 `pnpm-workspace.yaml`。包管理器按 `packageManager` 字段、锁文件与已装依赖判断，都没有就用 npm。

## 网页模式

```
nodex web             默认 8200
    --host 地址        默认 0.0.0.0；只想本机用 --host 127.0.0.1
-p, --port 端口        默认 8200
-o, --open           打开默认浏览器
    --json           只打一行地址给脚本用
```

页面按工作区分栏，可启停脚本、装依赖、压缩文件；每个工作区还能选 Node 版本。压缩交给同目录的 `zipx`，包落在工作区根目录，同名直接覆盖。

页面没有登录，默认绑所有网卡；只想本机用就加 `--host 127.0.0.1`。

## 退出码

| 码 | 含义 |
| --- | --- |
| 0 | 成功 |
| 1 | 执行失败，或当前目录下没找到目标 |
| 2 | 用法错误，或目录不是 Node 工程 |
| 3 | 用户取消 |
