# nodex

省去手敲 `pnpm --filter <包> run dev` 这类长命令。从当前目录找 Node 工作区里的包，勾选后启动、构建或装依赖。

## 用法

```
nodex                 先选命令，再勾包
nodex dev             同上，显式写命令名
nodex build           列出有 build 脚本的包，勾选后构建
nodex install         列工作区根与所有子包，按包管理器只装选中的
nodex dev web         按关键词跳过勾选，直接启动名字里带 web 的包
nodex --list          只列出目标，不执行；没写命令时按 dev 列
nodex --refresh       清掉当前命令上次的勾选记录，重新开始
nodex --help          显示帮助，命令清单从注册表生成
nodex web             起网页界面
```

## 工作区与包

从当前目录往上找最近的 `package.json`，它就是扫描根。工作区成员按下面两处声明识别，两处都认：

- `package.json` 的 `workspaces`，数组或 `{"packages": [...]}` 都行。
- `pnpm-workspace.yaml` 的 `packages`。

glob 支持 `*`、`**`、`?`，以 `!` 开头的模式表示排除。`node_modules`、`dist`、`build`、`.next`、`.nuxt` 这类目录不往里找。根自己也算一个包：单包工程只有它。

## 命令与脚本

| 命令      | 目标                               | 执行                                                       |
| --------- | ---------------------------------- | ---------------------------------------------------------- |
| `dev`     | 有 `dev`、`start` 或 `serve` 脚本的包 | 进包目录执行 `pnpm run dev`（脚本名按实际有的取）          |
| `build`   | 有 `build` 脚本的包                | 进包目录执行 `pnpm run build`                              |
| `install` | 工作区根与所有子包                 | 根执行 `pnpm install`；子包执行 `pnpm --filter <包名> install` |

`install` 的三家写法：

| 包管理器 | 子包安装命令                     |
| -------- | -------------------------------- |
| pnpm     | `pnpm --filter <包名> install`   |
| npm      | `npm install --workspace <包名>` |
| yarn     | `yarn workspace <包名> install`  |

包管理器按这个顺序判定：`package.json` 的 `packageManager` 字段、`node_modules` 里装过依赖的痕迹、`pnpm-lock.yaml`、`yarn.lock`、`package-lock.json`，都没有就用 npm。已经装过依赖时以实际装它的那个为准，因为锁文件常留着过时的那一份。

## 网页模式

```
nodex web             起网页界面，左侧添加工作区，右侧点按钮启动、打包、装依赖
    --host 地址        监听地址，默认 0.0.0.0；只想本机用 --host 127.0.0.1
-p, --port 端口        监听端口，默认 0 由系统挑一个空闲的
-o, --open           起来后打开默认浏览器
    --json           只打一行 {"url":…,"local":…,"host":…,"port":…}，给脚本起服务用
```

页面按工作区分栏：启动服务、打包、安装、模块清单。每栏的参数与日志各归各的，日志从对应行打开。

每个工作区可以单独选 Node 版本：自动扫 `~/.nvm/versions/node`、`~/.local/share/fnm/node-versions`、`~/.volta/tools/image/node` 与 `/usr/local/n/versions/node`，也可以手填版本目录。启动时把选中版本的 `bin` 放到 `PATH` 最前；目录不在了就回退到当前环境。

日志按运行号分开，位于 `~/.cache/nodex/web/logs/<工作区>/<运行号>.log`；状态与 Node 选择在 `~/.cache/nodex/web/` 下。页面通过 SSE 收日志与头部指标。

前端源码在 `web/`，打包步骤见 `web/README.md`。

## 退出码

| 码 | 含义                                           |
| -- | ---------------------------------------------- |
| 0  | 成功                                           |
| 1  | 找到了目标但执行失败，或者当前目录下没找到目标 |
| 2  | 用法错误：未知选项、目录不是 Node 工程         |
| 3  | 用户取消：在菜单或勾选界面里取消               |

## 安全约定

- **只读扫描**：不改 `package.json`，不写 `node_modules`，也不动锁文件。
- **勾选记录只写缓存目录**（`~/.cache/nodex`），`--refresh` 只清当前目录当前命令这一份。
- **装依赖串行执行**：同一个工作区里两条 install 同时跑会抢锁，终端里按选择顺序一条条装完，网页里同工作区的安装也不并发。
- **多条目标后台执行时共用当前终端**，按一次 Ctrl+C 送到整个前台进程组，所有任务一起退出。
- **网页没有登录**：默认绑所有网卡，同一网络里能连上的人都能启停服务；只想本机用就加 `--host 127.0.0.1`。
