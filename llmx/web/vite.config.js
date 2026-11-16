import { defineToolConfig } from '@bash-scripts/web-shared/vite-preset'

// dev 时代理到 llmx web 的端口（默认 8770），部署时整包由 llmx web 自己发出。
export default defineToolConfig({
  here: import.meta.url,
  outDir: '../lib/llmx/web/static',
  apiPath: '/api',
  env: 'LLMX_WEB_ORIGIN',
  dedupe: ['vue', 'vuetify'],
})
