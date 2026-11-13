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
  components/         LogView、DirectoryPicker、DirectoryNode
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
import { LogView, DirectoryPicker, fileIcon, useSplitPane, useFileTree } from '@bash-scripts/web-shared'
import '@bash-scripts/web-shared/style.css'

// 代码着色只有 dvcsx 用，走单独的入口，其余工程不会因此装上 highlight.js。
import { highlightCode, languageOf } from '@bash-scripts/web-shared/highlight'
```

## 里面有什么

| 导出 | 用途 | 谁在用 |
| ---- | ---- | ------ |
| `LogView` | xterm 日志终端：增量追加、滚到底、选中复制 | nodex、mvnx、dvcsx |
| `DirectoryPicker` / `DirectoryNode` | 从家目录往下选目录；提示文案与取数函数由调用方传 | nodex、mvnx、dvcsx |
| `fileIcon` | 文件类型图标与配色 | nodex、dvcsx |
| `useSplitPane` | 面板分隔条：拖动改尺寸、双击还原、宽度记忆 | dvcsx |
| `useFileTree` | 带路径的列表摆成目录树 | dvcsx |
| `highlightCode` / `languageOf`（子入口 `/highlight`） | 按扩展名做语法着色 | dvcsx |

## 依赖怎么算

`vue`、`@xterm/xterm`、`@xterm/addon-fit` 是 peerDependencies，构建时外置，由使用方提供。三个工程的 `vite.config.js` 里都写了 `resolve.dedupe: ['vue', '@xterm/xterm', '@xterm/addon-fit']`，保证只用工程自己那一份，不会出现两个 Vue 实例。

## 放进来之前先想清楚

- **只放三边真的同构的东西。** 配色这类差异交给调用方：`LogView` 的行着色是 `colorize` 属性传进来的，nodex 传 npm/Vite 的规则，mvnx 传 Maven 的规则，两边各留自己的 `logColor.js`。
- **别把接口封装带进来。** `useApi.js`、`format.js` 看着像，字段与函数各工程不一样，共用只会逼着改业务。
- **样式随包发。** 组件的 scoped 样式与 xterm 的样式都收进 `dist/web-shared.css`，工程在 `main.js` 里引一次即可。
