import { defineToolConfig } from '@bash-scripts/web-shared/vite-preset'

// 开发时代理到 jvmx web 的端口（默认 8300，见 ~/.cache/jvmx/web 旁的输出）。
export default defineToolConfig({
  here: import.meta.url,
  outDir: '../lib/jvmx/web/static',
  apiPath: '/__jvmx/api',
  env: 'JVMX_WEB_ORIGIN',
})
