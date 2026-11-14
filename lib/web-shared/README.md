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
  index.js / ui.js / theme.js / vite-preset.js   入口
  components/                                    通用组件
  composables/                                   组合式函数
  utils/                                         纯工具
  styles/                                        基础样式
test/                                            node:test 用例
```

## 四个工程怎么接

`package.json` 里加一条依赖（四边都已经写好）：

```json
"@bash-scripts/web-shared": "file:../../lib/web-shared"
```

代码里按包名引用：

```js
import { WorkspaceShell, ServiceTable, LogView } from '@bash-scripts/web-shared'
import '@bash-scripts/web-shared/style.css'

// 其余子入口按需引入：theme、format、http、logs、ui、highlight、diff、metrics、vite-preset。
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
| `WorkspaceShell` | 工作区页面外壳：顶栏、在跑计数、指标插槽、主题开关、左栏与右侧内容插槽、空状态 | nodex、mvnx |
| `ServiceTable` | 服务清单表格：状态、端口、耗时、启动/停止/参数/日志按钮；第一列表头由 `nameTitle` 给，工具独有的行内按钮走 `row-extra` 插槽 | nodex、mvnx |
| `RunLogPanel` | 设置与日志弹窗里的日志区：尾部一页、更早、行着色 | nodex、mvnx |
| `useRunLog` | 日志弹窗的数据：SSE 尾部与追加、往前翻页、运行状态同步 | nodex、mvnx |
| `useWorkspaceState` | 工作区状态：状态 SSE、动作串行、增删工作区、启停与保存参数；工具链候选走 `loadExtra`，业务文案由调用方给 | nodex、mvnx |
| `runningCount` / `LIVE_STATUSES` | 服务在跑计数与活动状态，放在主入口，不进 `/format` | nodex、mvnx |
| `createThemedVuetify` / `useThemeToggle`（子入口 `/theme`） | Vuetify 实例与深浅色主题；标题栏开关可跟随系统 | dvcsx、nodex、mvnx、tokx |
| `baseName` / `dirName` / `shortPath` / `shortenPath` / `firstLine` / `formatDateTime` / `formatAgo` / `formatBytes` / `formatNumber` / `formatMoney` / `formatCompact`（子入口 `/format`） | 纯格式化函数，业务常量与端点表仍留在各工程 | 四边 |
| `ApiError` / `encodeParam` / `createJsonClient`（子入口 `/http`） | 统一 JSON 请求与错误文案，前缀和文案由调用方传 | 四边 |
| `paint` / `createLogColorizer`（子入口 `/logs`） | 日志着色骨架，规则表由调用方传 | nodex、mvnx |
| `EmptyState` / `ToastHost` / `useToast`（子入口 `/ui`） | 空状态、页面提示条与提示状态；轻量入口不到 xterm、echarts | 四边 |
| `fileIcon` | 文件类型图标与配色 | nodex、dvcsx |
| `SplitHandle` | 分隔条本身：横向或纵向、拖动中高亮、双击还原、禁用态 | dvcsx |
| `useSplitPane` | 分隔条背后的尺寸逻辑：拖动改尺寸、双击还原、宽度记忆 | dvcsx |
| `useFileTree` | 带路径的列表摆成目录树 | dvcsx |
| `highlightCode` / `languageOf`（子入口 `/highlight`） | 按扩展名做语法着色 | dvcsx |
| `Metrics`（子入口 `/metrics`） | 性能组件默认组合：CPU、内存、磁盘三条 5 分钟曲线 | nodex、mvnx |
| `MetricCpu` / `MetricMemory` / `MetricDisk`（子入口 `/metrics`） | 单个指标 widget，业务按需取用 | nodex、mvnx |
| `MetricSparkline`（子入口 `/metrics`） | 通用指标曲线：名称、当前值、历史、阈值变色 | nodex、mvnx |

组件与组合式函数的 props、事件与插槽以源码为准；各工程已经在用，改动共享件时先看对应组件的 `defineProps` / `defineEmits`。`vite-preset.js` 统一了四个工程的 Vue 插件、vuetify 别名、依赖去重、产物目录与代理，调用方只需传 `here`、`outDir`、`apiPath`、`env`。

## 依赖怎么算

`vue`、`vuetify`、`@vueuse/core`、`@xterm/xterm`、`@xterm/addon-fit` 是 peerDependencies，构建时外置，由使用方提供。`@vueuse/core` 只给 `useWorkspaceState` 记当前工作区用。各个工程的 `vite.config.js` 里都写了 `resolve.dedupe`，保证只用工程自己那一份，不会出现两个 Vue 实例。`highlight.js`、`echarts` 与两个 xterm 包是可选 peer：只有引了对应子入口或组件（`/highlight`、`/diff`、`/metrics`、`LogView`）的工程才需要装。`highlight.js` 同时给 `/highlight` 与 `/diff` 两个入口用；`vuetify` 只有 `/theme` 入口与各组件在运行时要。

## 放进来之前先想清楚

- **只放四边真的同构的东西。** 配色与业务词汇交给调用方：`LogView` 的行着色由调用方传规则；`/format` 只收纯函数，`statusOf`、`TYPE_TEXT`、`MODE_ITEMS`、`COLUMN` 这类业务常量仍留在各工程。
- **接口只抽骨架，不带端点表。** `/http` 的 `createJsonClient` 只管请求方式与错误文案，前缀、端点表、业务字段由各工程自己写；`/logs` 同理，只抽匹配与套色流程。
- **样式随包发。** 组件的 scoped 样式与 xterm 的样式都收进 `dist/web-shared.css`，工程在 `main.js` 里引一次即可。
