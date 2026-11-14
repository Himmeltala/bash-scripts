import { toolConfig } from '@bash-scripts/web-shared/vite-preset'

// 开发时代理到 dvcsx web 的端口（默认 8771，见 ~/.cache/dvcsx/web/runner.log 里的地址）。
export default toolConfig({
  here: import.meta.url,
  outDir: '../lib/dvcsx/web/static',
  apiPath: '/__dvcsx/api',
  env: 'DVCSX_WEB_ORIGIN',
  fallback: 'http://127.0.0.1:8771',
  dedupe: ['vue', '@vueuse/core', '@xterm/xterm', '@xterm/addon-fit', 'highlight.js'],
})
