import { defineToolConfig } from '@bash-scripts/web-shared/vite-preset'

// 开发时代理到 nodex web 的端口（默认 8770，见 ~/.cache/nodex/web/runner.log 里的地址）。
export default defineToolConfig({
  here: import.meta.url,
  outDir: '../lib/nodex/web/static',
  apiPath: '/__nodex/api',
  env: 'NODEX_WEB_ORIGIN',
})
