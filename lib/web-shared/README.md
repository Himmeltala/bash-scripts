# web-shared

nodex、mvnx、dvcsx、llmx 共用的 Vue 组件、组合式函数与主题，做成 `file:` 依赖的本地包：源码在这里，编出 `dist/` 供各工程引用。

## 编译

```bash
cd lib/web-shared
npm install
npm run build       # 产出各子入口与 dist/web-shared.css
npm test            # node:test，只测纯函数
```

改了这里要先编共享包，再编各工程。产物文件名不带哈希，`install.sh` 每次安装会重建。

## 接入

```json
"@bash-scripts/web-shared": "file:../../lib/web-shared"
```

```js
import { WorkspaceShell, ServiceTable, LogView } from '@bash-scripts/web-shared'
import '@bash-scripts/web-shared/style.css'
```

子入口按需引入：`theme`、`format`、`http`、`logs`、`ui`、`highlight`、`diff`、`metrics`、`vite-preset`。

## 导出

| 分类 | 导出 |
| --- | --- |
| 日志与动作 | `LogView`、`RunLogPanel`、`useRunLog`、`paint`、`createLogColorizer`（`/logs`） |
| 工作区 | `WorkspaceList`、`WorkspaceShell`、`ServiceTable`、`useWorkspaceState`、`DirectoryPicker`、`FileTree`、`useFileTree` |
| 文件 | `FileEditor`、`DiffView`（`/diff`）、`highlightCode`/`languageOf`（`/highlight`）、`fileIcon` |
| 弹窗与布局 | `FloatingDialog`、`SplitHandle`、`useSplitPane` |
| 主题 | `createThemedVuetify`、`useThemeToggle`（`/theme`） |
| 工具 | `baseName`/`dirName`/`shortPath`/`formatBytes`/`formatMoney` 等（`/format`）、`createJsonClient`（`/http`） |
| 提示 | `EmptyState`、`ToastHost`、`useToast`（`/ui`） |
| 指标 | `Metrics`、`MetricCpu`/`MetricMemory`/`MetricDisk`/`MetricDownload`/`MetricUpload`、`MetricSparkline`（`/metrics`） |
| 构建 | `vite-preset.js`：Vue 插件、vuetify 别名、依赖去重、产物目录、代理与固定文件名 |

组件 props、事件与插槽以源码为准。`vite-preset` 调用方只传 `here`、`outDir`、`apiPath`、`env`。

## 依赖

`vue`、`vuetify`、`@vueuse/core`、`@xterm/xterm`、`@xterm/addon-fit` 是 peerDependencies，构建时外置；`highlight.js`、`echarts` 与 xterm 包是可选 peer，只有引用对应入口或组件时才需要。各工程用 `resolve.dedupe` 保证只有一个 Vue。

## 边界

- 只放四边真正同构的东西；配色、业务词汇、状态与类型常量留在各工程。
- `/http` 与 `/logs` 只抽骨架，前缀、端点表与着色规则由调用方传。
- 组件样式收进 `dist/web-shared.css`，工程在 `main.js` 引一次。
