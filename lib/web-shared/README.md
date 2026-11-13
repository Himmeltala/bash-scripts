# web-shared

nodex、mvnx、dvcsx 三个网页界面共用的组件与组合式函数，做成一个本地 npm 包：源码在这里，编出 `dist/`，三个工程按 `file:` 依赖装进去引用。

## 编译

```bash
cd lib/web-shared
npm install
npm run build          # 产出 dist/web-shared.js 与 dist/web-shared.css
```

三个工程引用的是 `dist/` 的产物，改了这里的源码要**先编这里，再编工程**，否则看不到变化。

## 目录

```
src/
  index.js            主入口
  components/         LogView、DirectoryPicker/、FileTree/、FileEditor/、Metrics/、SplitHandle
  composables/        useSplitPane、useFileTree
  utils/              fileIcons、highlight（代码着色，单独一个入口）
```

## 三个工程怎么接

`package.json` 里加一条依赖（三边都已经写好）：

```json
"@bash-scripts/web-shared": "file:../../lib/web-shared"
```

代码里按包名引用：

```js
import { LogView, DirectoryPicker, FileTree, FileEditor, SplitHandle, fileIcon, useSplitPane, useFileTree } from '@bash-scripts/web-shared'
import '@bash-scripts/web-shared/style.css'

// 代码着色只有 dvcsx 用，走单独的入口，其余工程不会因此装上 highlight.js。
import { highlightCode, languageOf } from '@bash-scripts/web-shared/highlight'

// 性能指标依赖 echarts，也走单独的入口；不用指标的工程不会因此装上 echarts。
import { Metrics, MetricCpu, MetricDisk, MetricMemory, MetricSparkline } from '@bash-scripts/web-shared/metrics'
```

## 里面有什么

| 导出 | 用途 | 谁在用 |
| ---- | ---- | ------ |
| `LogView` | xterm 日志终端：增量追加、滚到底、选中复制 | nodex、mvnx、dvcsx |
| `DirectoryPicker` / `DirectoryNode` | 从家目录往下选目录；提示文案、取数函数与校验（`validate`、`invalidText`）由调用方传 | nodex、mvnx、dvcsx |
| `FileTree` | 懒加载的目录树：展开、缓存、图标、提示都由它管；取数函数与行内内容由调用方传 | nodex、dvcsx |
| `FileEditor` | 文件编辑区：面包屑、行号、语法高亮、草稿与保存、未保存确认；取数与落盘由调用方传 | dvcsx |
| `fileIcon` | 文件类型图标与配色 | nodex、dvcsx |
| `SplitHandle` | 分隔条本身：横向或纵向、拖动中高亮、双击还原、禁用态 | dvcsx |
| `useSplitPane` | 分隔条背后的尺寸逻辑：拖动改尺寸、双击还原、宽度记忆 | dvcsx |
| `useFileTree` | 带路径的列表摆成目录树 | dvcsx |
| `highlightCode` / `languageOf`（子入口 `/highlight`） | 按扩展名做语法着色 | dvcsx |
| `Metrics`（子入口 `/metrics`） | 性能组件默认组合：CPU、内存、磁盘三条 5 分钟曲线 | nodex、mvnx |
| `MetricCpu` / `MetricMemory` / `MetricDisk`（子入口 `/metrics`） | 单个指标 widget，业务按需取用 | nodex、mvnx |
| `MetricSparkline`（子入口 `/metrics`） | 通用指标曲线：名称、当前值、历史、阈值变色 | nodex、mvnx |

### FileTree

树自己管展开状态与每一层的缓存，只在展开时调 `loader(key)`。两边节点字段不同，用 `keyOf` / `dirOf` / `nameOf` 适配；行内差异走 `row-before-label` 与 `row-after-label` 两个插槽（作用域带 `node`、`open`、`state`）。`root` 传节点就在顶上显示根行，不传就直接列第一层；`pickOnRowClick` 决定整行点击是否等于选中；`active` 为假时不读目录。`defineExpose` 给出 `reveal / reload / reloadDir / refreshAll`，对应定位、全量重读、重读一层与刷新。右键菜单复制相对路径与绝对路径、下载文件或目录（目录由后端打包）；`rootPath` 给绝对路径的根，`downloadOf(node)` 给下载地址，两者不传就隐藏对应菜单项。

### FileEditor

`components/FileEditor/` 收编辑器全部相关代码：外壳、面包屑、行号与高亮输入区、未保存确认对话框、草稿与保存状态、配套样式。`loader(path)` 与 `saver(path, text)` 由调用方传，组件不认具体接口；`rootName` 与 `size` 只管显示。`navigate` 事件在点根目录或面包屑时带出目标路径。`defineExpose` 给出 `open(path, line) / reload / close / save / confirmLeave / cancelLeave / dirty`：换文件前先 `confirmLeave()`，保存走 `save()` 并拿回接口结果。

### Metrics

`components/Metrics/` 是性能组件，按 widget 拆开：`MetricCpu`、`MetricMemory`、`MetricDisk` 三个指标，底下共用一个 `MetricSparkline`（60 个点、5 秒一个，共 5 分钟）。`Metrics` 是默认组合，三件套排成一行并在窄屏隐藏；业务也可以只引其中一个 widget 自己摆，布局与断点自己定。

所有 widget 都吃同一份指标快照，字段与后端 SSE 一致：`{ time, cpu, mem: { percent }, disk: { percent, mount } }`。当前值达到 85% 标红；`MetricSparkline` 还能直接接自定义名称、颜色与阈值。曲线用 echarts，走子入口 `/metrics`，由使用方提供 echarts（`peerDependencies` 里是可选项）。

## 依赖怎么算

`vue`、`@xterm/xterm`、`@xterm/addon-fit` 是 peerDependencies，构建时外置，由使用方提供。三个工程的 `vite.config.js` 里都写了 `resolve.dedupe: ['vue', '@xterm/xterm', '@xterm/addon-fit']`，保证只用工程自己那一份，不会出现两个 Vue 实例。`highlight.js` 与 `echarts` 也是外置的可选 peer：只有引了对应子入口的工程才需要在 `package.json` 里装它。

## 放进来之前先想清楚

- **只放三边真的同构的东西。** 配色这类差异交给调用方：`LogView` 的行着色是 `colorize` 属性传进来的，nodex 传 npm/Vite 的规则，mvnx 传 Maven 的规则，两边各留自己的 `logColor.js`。
- **别把接口封装带进来。** `useApi.js`、`format.js` 看着像，字段与函数各工程不一样，共用只会逼着改业务。
- **样式随包发。** 组件的 scoped 样式与 xterm 的样式都收进 `dist/web-shared.css`，工程在 `main.js` 里引一次即可。
