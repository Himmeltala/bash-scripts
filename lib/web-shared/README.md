# web-shared

idex、llmx、netx 共用的 Vue 组件、组合式函数与主题，做成 `file:` 依赖的本地包。

## 编译

```bash
cd lib/web-shared
npm install
npm run build       # 产出 dist/ 与 dist/web-shared.css
npm test            # node:test，只测纯函数
```

改了这里要先编共享包，再编各工程；`install.sh` 每次安装会重建。

## 接入

```json
"@bash-scripts/web-shared": "file:../../lib/web-shared"
```

```js
import { WorkspaceShell, ServiceTable, LogView } from '@bash-scripts/web-shared'
import '@bash-scripts/web-shared/style.css'
```

子入口按需引入：`theme`、`format`、`http`、`logs`、`highlight`、`diff`、`metrics`、`text`、`layouts`、`feedbacks`、`vite-preset`。

## 目录

`components`、`composables`、`utils`、`styles` 各分两层：`commons` 与具体工具无关，`services` 是这几个工具共用的工作区与服务件。配色、业务词汇与状态常量留在各工程。
