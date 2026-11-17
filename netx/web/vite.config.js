import { defineToolConfig } from '@bash-scripts/web-shared/vite-preset'

// 开发时代理到 netx web 的端口（默认 8400）。
export default defineToolConfig({
  here: import.meta.url,
  outDir: '../lib/netx/static',
  apiPath: '/__netx/api',
  env: 'NETX_WEB_ORIGIN',
  fallback: 'http://127.0.0.1:8400',
})
