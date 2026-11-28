# web-shared

idex、llmx、netx 共用的 Vue 组件、组合式函数与主题，作为 `file:` 依赖引入。

## 编译

```bash
cd lib/web-shared
npm install
npm run build
npm test
```

## 接入

```json
"@bash-scripts/web-shared": "file:../../lib/web-shared"
```

```js
import { WorkspaceShell, ServiceTable, LogView } from '@bash-scripts/web-shared'
import '@bash-scripts/web-shared/style.css'
```
