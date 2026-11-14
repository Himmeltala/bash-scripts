import { toolConfig } from '@bash-scripts/web-shared/vite-preset'

// 开发时代理到 mvnx web 的端口（默认 8770，见 ~/.cache/mvnx/web/runner.log 里的地址）。
export default toolConfig({
  here: import.meta.url,
  outDir: '../lib/mvnx/web/static',
  apiPath: '/__mvnx/api',
  env: 'MVNX_WEB_ORIGIN',
})
