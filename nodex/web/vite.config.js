import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// 开发时代理到 nodex web 的端口（默认 8770，见 ~/.cache/nodex/web/runner.log 里的地址）。
const backend = process.env.NODEX_WEB_ORIGIN || 'http://127.0.0.1:8770'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    // vuetify 的默认入口不带组件，只装了骨架；走带组件的入口，模板里的 v-* 才有人认。
    alias: [{ find: /^vuetify$/, replacement: 'vuetify/lib/entry-bundler.js' }],
    // 共用的包是软链进来的，依赖统一用本工程这一份，免得 Vue 出两个实例。
    dedupe: ['vue', '@xterm/xterm', '@xterm/addon-fit'],
  },
  // 打包到 lib/nodex/web/static，产物跟源码一起进仓库，本机不需要 Node 也能用网页。
  base: './',
  build: {
    outDir: '../lib/nodex/web/static',
    emptyOutDir: true,
    chunkSizeWarningLimit: 900,
  },
  server: {
    // 共用的包在 lib/web-shared，开发时要读仓库里这一层。
    fs: { allow: ['../..'] },
    proxy: {
      '/__nodex/api': backend,
    },
  },
})
