# web-shared

nodex、mvnx、dvcsx、tokx 四个网页界面共用的组件、组合式函数与主题，做成一个本地 npm 包：源码在这里，编出 `dist/`，各个工程按 `file:` 依赖装进去引用。

## 编译

```bash
cd lib/web-shared
npm install
npm run build          # 产出各子入口与 dist/web-shared.css
npm test               # node:test，只测纯函数
```

四个工程引用的是 `dist/` 的产物，改了这里的源码要**先编这里，再编工程**，否则看不到变化。

## 目录

```
src/
  index.js            主入口
  ui.js               轻量 UI 入口：EmptyState、ToastHost、useToast
  theme.js            Vuetify 主题工厂与 useThemeToggle（单独一个入口）
  components/         LogView、EmptyState、ToastHost、DirectoryPicker/、FileTree/、
                      FileEditor/、DiffView/、FloatingDialog/、WorkspaceList/、Metrics/、SplitHandle
  composables/        useSplitPane、useFileTree、useDialogLayout、useToast
  styles/             base.css（字体与拖动时的全局规则）
  utils/              fileIcons、highlight（代码着色）、format、http、logColor
test/                 format 与 http 的 node:test 用例
```

## 四个工程怎么接

`package.json` 里加一条依赖（四边都已经写好）：

```json
"@bash-scripts/web-shared": "file:../../lib/web-shared"
```

代码里按包名引用：

```js
import { LogView, DirectoryPicker, FileTree, FileEditor, FloatingDialog, WorkspaceList, SplitHandle, fileIcon, useSplitPane, useFileTree } from '@bash-scripts/web-shared'
import '@bash-scripts/web-shared/style.css'

// Vuetify 实例、公共主题与标题栏开关走单独的入口；tokx 也只用这一块。
import { createThemedVuetify, useThemeToggle } from '@bash-scripts/web-shared/theme'

// 纯格式化函数：路径、时间、文件大小、数字与金额，不依赖 UI 库。
import { baseName, dirName, firstLine, formatAgo, formatBytes, formatNumber, formatMoney, formatCompact } from '@bash-scripts/web-shared/format'

// HTTP 客户端：统一 JSON 请求、错误文案与 ApiError.status。
import { ApiError, q, createJsonClient } from '@bash-scripts/web-shared/http'

// 日志着色骨架：各工程传自己的规则表。
import { RESET, paint, createLogColorizer } from '@bash-scripts/web-shared/logs'

// 轻量 UI：空状态、提示条与 useToast；不拉 xterm、highlight.js、echarts。
import { EmptyState, ToastHost, useToast } from '@bash-scripts/web-shared/ui'

// 代码着色只有 dvcsx 用，走单独的入口，其余工程不会因此装上 highlight.js。
import { highlightCode, languageOf } from '@bash-scripts/web-shared/highlight'

// 差异视图同样依赖 highlight.js，也走单独的入口。
import DiffView from '@bash-scripts/web-shared/diff'

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
| `DiffView`（子入口 `/diff`） | 差异视图：按行显示统一 diff，给了工作副本快照就能在行内直接改；快照与保存由调用方处理 | dvcsx |
| `FloatingDialog` | 可拖动、可拉伸、位置与大小记忆的浮窗；`storageKey` 是窗名，`storage` 是浏览器里的位置表名 | nodex、mvnx |
| `WorkspaceList` | 工作副本/工作区左栏：添加、移出、别名、右键复制路径；取目录与存别名的接口由调用方传 | dvcsx、nodex、mvnx |
| `createThemedVuetify` / `useThemeToggle`（子入口 `/theme`） | Vuetify 实例与深浅色主题；标题栏开关可跟随系统 | dvcsx、nodex、mvnx、tokx |
| `baseName` / `dirName` / `shortPath` / `shortenPath` / `firstLine` / `formatDateTime` / `formatAgo` / `formatBytes` / `formatNumber` / `formatMoney` / `formatCompact`（子入口 `/format`） | 纯格式化函数，业务常量与端点表仍留在各工程 | 四边 |
| `ApiError` / `q` / `createJsonClient`（子入口 `/http`） | 统一 JSON 请求与错误文案，前缀和文案由调用方传 | 四边 |
| `RESET` / `paint` / `createLogColorizer`（子入口 `/logs`） | 日志着色骨架，规则表由调用方传 | nodex、mvnx |
| `EmptyState` / `ToastHost` / `useToast`（子入口 `/ui`） | 空状态、页面提示条与提示状态；轻量入口不到 xterm、echarts | 四边 |
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

`components/FileEditor/` 收编辑器全部相关代码：外壳、面包屑、行号与高亮输入区、未保存确认对话框、草稿与保存状态、配套样式。`loader(path)` 与 `saver(path, text)` 由调用方传，组件不认具体接口；`rootName` 与 `size` 只管显示。`navigate` 事件在点根目录或面包屑时带出目标路径。有未保存改动时头部出现「未保存」与保存/放弃，放弃退回打开时那份内容；保存成功后发 `saved` 事件，带 `{ path, data }`，目录树之类的调用方拿它刷新。`defineExpose` 给出 `open(path, line) / reload / close / save / discard / confirmLeave / cancelLeave / dirty`：换文件前先 `confirmLeave()`，保存走 `save()` 并拿回接口结果。

### DiffView

`components/DiffView/` 吃一份统一 diff 文本（`text`），按 hunk 拆成新旧行号两列显示，`path` 决定语法着色。`kind` 为 `file` 时按整份文件内容显示，每行都算新增。`editable` 与 `baseText` 一起用：给了工作副本快照就能点行内直接改，Enter 拆行、行首 Backspace 并上一行、行尾 Delete 并下一行，`collect()` 交回改完的整份文件；`dirty` 事件通知有没有改动，`resetEdits()` 丢掉草稿。快照怎么取、改完写回哪里都由调用方做，组件不认接口；`readOnlyReason` 只负责把不能改的原因显示在头部。提示文案可以用 `texts` 覆盖（`loading`、`empty`、`truncated`、`fileNote`）。

### FloatingDialog

`components/FloatingDialog/` 是浮窗外壳：标题栏可拖动，右下角可拉伸，双击标题回到屏幕中间。位置与大小按 `storageKey` 存在浏览器里，`storage` 给各工程自己的存储表名；存不进去时只在这次会话里生效。内容、标题与按钮全部走插槽，组件不管里面放什么。

### WorkspaceList

`components/WorkspaceList/` 是左侧工作区列表：添加目录、移出、设置别名、右键复制相对/绝对路径。`dirs(path)` 给目录树取数，`saveAlias(id, alias)` 负责落盘，两者由调用方传；`texts` 覆盖文案（标题、按钮、提示、确认框），`title-extra` 插槽在名字后面补业务标签（dvcsx 用来放 Git/SVN 标记）。事件与原来一致：`select`、`add`、`remove`、`changed`、`notice`。

### 主题与基础样式

`theme.js` 走子入口 `/theme`，导出 `createThemedVuetify({ storageKey, colors, options })`：底座色板（背景、表面、主色等）四边共用，`colors.light` / `colors.dark` 只补各自的语义色（`ready`/`failed`、`modified`/`added` 之类），`options` 原样并进 `createVuetify`（tokx 用它加中文 locale）。返回 `{ vuetify, initialTheme, rememberTheme }`，主题名存在 `storageKey` 里，兼容旧的单字符串与 JSON 字符串两种写法。

同一入口还导出 `useThemeToggle({ storageKey, rememberTheme, followSystem })`，返回 `{ theme, dark, toggle, setTheme }`。`followSystem` 为真时，用户没手动切过就继续跟系统走；切换过一次后系统变化不再覆盖用户选择（tokx 用这个行为）。

`styles/base.css` 随主入口一起进 `dist/web-shared.css`：统一的 Roboto 与中文字体、代码与日志的等宽字体、拖动分隔条时禁止选中文字。工程 `main.js` 引一次 `style.css` 即可，不再各写一份 `styles/base.css`。

### Metrics

`components/Metrics/` 是性能组件，按 widget 拆开：`MetricCpu`、`MetricMemory`、`MetricDisk` 三个指标，底下共用一个 `MetricSparkline`（60 个点、5 秒一个，共 5 分钟）。`Metrics` 是默认组合，三件套排成一行并在窄屏隐藏；业务也可以只引其中一个 widget 自己摆，布局与断点自己定。

所有 widget 都吃同一份指标快照，字段与后端 SSE 一致：`{ time, cpu, mem: { percent }, disk: { percent, mount } }`。当前值达到 85% 标红；`MetricSparkline` 还能直接接自定义名称、颜色与阈值。曲线用 echarts，走子入口 `/metrics`，由使用方提供 echarts（`peerDependencies` 里是可选项）。

## 依赖怎么算

`vue`、`vuetify`、`@xterm/xterm`、`@xterm/addon-fit` 是 peerDependencies，构建时外置，由使用方提供。各个工程的 `vite.config.js` 里都写了 `resolve.dedupe`，保证只用工程自己那一份，不会出现两个 Vue 实例。`highlight.js`、`echarts` 与两个 xterm 包是可选 peer：只有引了对应子入口或组件（`/highlight`、`/diff`、`/metrics`、`LogView`）的工程才需要装。`highlight.js` 同时给 `/highlight` 与 `/diff` 两个入口用；`vuetify` 只有 `/theme` 入口与各组件在运行时要。

## 放进来之前先想清楚

- **只放四边真的同构的东西。** 配色与业务词汇交给调用方：`LogView` 的行着色由调用方传规则；`/format` 只收纯函数，`statusOf`、`TYPE_TEXT`、`MODE_ITEMS`、`COLUMN` 这类业务常量仍留在各工程。
- **接口只抽骨架，不带端点表。** `/http` 的 `createJsonClient` 只管请求方式与错误文案，前缀、端点表、业务字段由各工程自己写；`/logs` 同理，只抽匹配与套色流程。
- **样式随包发。** 组件的 scoped 样式与 xterm 的样式都收进 `dist/web-shared.css`，工程在 `main.js` 里引一次即可。
