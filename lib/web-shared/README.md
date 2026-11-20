# web-shared

nodex、jvmx、idex、llmx、netx 共用的 Vue 组件、组合式函数与主题，做成 `file:` 依赖的本地包：源码在这里，编出 `dist/` 供各工程引用。

## 目录约定

`components`、`composables`、`utils`、`styles` 都分 `commons` 与 `services` 两层：

- `commons/`：与具体工具无关，新起一个不相干的项目也能直接用。文件编辑器、差异视图、日志终端、指标、浮窗、提示条、分隔条、目录选择、文件树、格式化与 HTTP 工具都在这里。
- `services/`：当前几个工具共用的「工作区 / 服务」业务件，只有做同类页面的项目才会用。`WorkspaceShell`、`WorkspaceList`、`ServiceTable`、`RunLogPanel`、`useWorkspaceState`、`useRunLog`、`serviceStatus`、`workspaceLayout` 属于这一类。

判断标准：B 项目与 A/C/D 无关时能否原样使用；能就是 `commons`，只是这几个工具之间共享的就是 `services`。业务样式留在组件自己的 scoped CSS 里，`styles/commons/base.css` 只放全局基础样式。

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
| 提示 | `EmptyState`、`LoadingState`、`ToastHost`、`useToast`（`/ui`） |
| 指标 | `Metrics`、`MetricCpu`/`MetricMemory`/`MetricDisk`/`MetricDownload`/`MetricUpload`、`MetricSparkline`（`/metrics`） |
| 构建 | `vite-preset.js`：Vue 插件、vuetify 别名、依赖去重、产物目录、代理与固定文件名 |

组件 props、事件与插槽以源码为准。`vite-preset` 调用方只传 `here`、`outDir`、`apiPath`、`env`。

## 依赖

`vue`、`vuetify`、`@vueuse/core`、`@xterm/xterm`、`@xterm/addon-fit` 是 peerDependencies，构建时外置；`highlight.js`、`echarts` 与 xterm 包是可选 peer，只有引用对应入口或组件时才需要。各工程用 `resolve.dedupe` 保证只有一个 Vue。

## 边界

- 只放四边真正同构的东西；配色、业务词汇、状态与类型常量留在各工程。
- `/http` 与 `/logs` 只抽骨架，前缀、端点表与着色规则由调用方传。
- 组件样式收进 `dist/web-shared.css`，工程在 `main.js` 引一次。
