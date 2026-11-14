import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// 共用组件的库构建：Vue、xterm、highlight.js 留给使用方（peerDependencies），样式收进 dist/web-shared.css。
export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      // 常规组件走主入口；依赖 highlight.js 的着色与差异视图单独出，谁用谁引。
      entry: {
        index: fileURLToPath(new URL('./src/index.js', import.meta.url)),
        highlight: fileURLToPath(new URL('./src/utils/highlight.js', import.meta.url)),
        diff: fileURLToPath(new URL('./src/components/DiffView/index.js', import.meta.url)),
        metrics: fileURLToPath(new URL('./src/components/Metrics/index.js', import.meta.url)),
        theme: fileURLToPath(new URL('./src/theme.js', import.meta.url)),
        // 纯工具与轻量 UI 各走一个入口，tokx 只引这些时不会碰到 xterm、echarts。
        format: fileURLToPath(new URL('./src/utils/format.js', import.meta.url)),
        http: fileURLToPath(new URL('./src/utils/http.js', import.meta.url)),
        logs: fileURLToPath(new URL('./src/utils/logColor.js', import.meta.url)),
        ui: fileURLToPath(new URL('./src/ui.js', import.meta.url)),
      },
      formats: ['es'],
      fileName: (format, name) => `${name}.js`,
    },
    rollupOptions: {
      external: ['vue', 'vuetify', '@xterm/xterm', '@xterm/addon-fit', /^highlight\.js/, /^echarts/],
    },
    outDir: 'dist',
    emptyOutDir: true,
    cssCodeSplit: false,
    sourcemap: false,
  },
})
