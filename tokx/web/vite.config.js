import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// dev 时代理到 tokx web 的端口（默认 8770），部署时整包由 tokx web 自己发出。
const backend = process.env.TOKX_WEB_ORIGIN || 'http://127.0.0.1:8770'

export default defineConfig({
  plugins: [vue()],
  // 打包到 Python 包里的 static 目录，产物跟源码一起进仓库。
  base: './',
  build: {
    outDir: '../lib/tokx/web/static',
    emptyOutDir: true,
    // echarts 按需引入后仍有 500 多 KB，本机访问不做限制提示。
    chunkSizeWarningLimit: 900,
  },
  server: {
    proxy: {
      '/api': backend,
    },
  },
})
