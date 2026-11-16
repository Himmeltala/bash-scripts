# nodex

在 Node 工作区里选脚本执行，省去手敲 `pnpm --filter <目录> run dev`。

## 用法

```
nodex                 先选命令，再勾脚本
nodex dev|build|install
nodex dev web         按关键词跳过勾选，直接跑名字带 web 的脚本
nodex --list          只列出目标；默认按 dev 列
nodex --refresh       清掉当前命令的勾选记录
nodex web             起网页界面
```

## 工作区与命令

从当前目录向上找最近的 `package.json` 作为扫描根；成员来自 `package.json` 的 `workspaces` 或 `pnpm-workspace.yaml`，glob 支持 `*`、`**`、`?` 与 `!` 排除。`node_modules`、`dist`、`build`、`.next`、`.nuxt` 不再往里找。

| 命令 | 目标 | 执行 |
| --- | --- | --- |
| `dev` | 有 `dev`、`start`、`serve` 或冒号变体 | `<包管理器> run <脚本>` |
| `build` | 有 `build` 或 `build:` 变体 | `<包管理器> run build` |
| `install` | 工作区根与所有子目录 | 根跑 `npm install`，子目录跑 `npm install --workspace <名称>` |

包管理器按 `packageManager` 字段、已装依赖的痕迹、`pnpm-lock.yaml`、`yarn.lock`、`package-lock.json` 的顺序判断，都没有就用 npm。网页里每条命令都能改，改完保存。

## 网页模式

```
nodex web             默认 8200，左侧添加工作区，右侧启停、打包、装依赖、压缩
    --host 地址        默认 0.0.0.0；只想本机用 --host 127.0.0.1
-p, --port 端口        默认 8200
-o, --open           打开默认浏览器
    --json           只打一行地址给脚本用
```

页面按工作区分栏；脚本表按启动、打包、安装排序，每行各有参数与日志。压缩栏把勾中的文件与目录交给同目录的 zipx 打包，包落在工作区根目录，同名直接覆盖。

工作区右键可设别名、复制相对或绝对路径；别名存在 `~/.cache/nodex/web/alias.tsv`。每个工作区可选 Node 版本，自动扫 nvm/fnm/volta/n 的目录，启动时把该版本 `bin` 放到 `PATH` 最前。日志在 `~/.cache/nodex/web/logs/<工作区>/<运行号>.log`，页面通过 SSE 收日志、指标与状态。

前端产物随仓库提交，文件名不带哈希；`./install.sh` 每次用 Node 重新构建。

## 退出码

| 码 | 含义 |
| -- | --- |
| 0 | 成功 |
| 1 | 执行失败，或当前目录下没找到目标 |
| 2 | 用法错误，或目录不是 Node 工程 |
| 3 | 用户取消 |

## 约定

- 扫描只读：不改 `package.json`、不写 `node_modules`、不动锁文件。
- 勾选记录只写 `~/.cache/nodex`；`--refresh` 只清当前目录当前命令这一份。
- 同一工作区的装依赖串行执行；多条目标共用终端，Ctrl+C 一起退出。
- 网页没有登录，默认绑所有网卡；只想本机用就加 `--host 127.0.0.1`。
