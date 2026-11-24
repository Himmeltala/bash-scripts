/*
 * @Author: Himmeltala
 * @Date: 2026-11-23 23:09:19
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 08:43:57
 * @FilePath: \lib\web-shared\vite-preset.js
 * @Description: 三个网页工程共用的 vite 配置：Vue 插件、vuetify 别名、共享包源码别名与接口代理。
*/

// 三个网页工程共用的 vite 配置：Vue 插件、vuetify 别名、依赖去重、代理与打包目录。
// 调用方把 import.meta.url 传进来，vuetify 从本工程这一份解析，免得出来两个 Vue。

import { dirname, resolve } from 'node:path'
import { createRequire } from 'node:module'
import tailwind from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// 开发时直接指到共享包的源码，改组件也能热更新；构建仍走 dist，与发布一致。
const SHARED_ENTRIES = {
  theme: 'src/theme.js',
  format: 'src/utils/commons/format.js',
  http: 'src/utils/commons/http.js',
  'tool-api': 'src/utils/services/toolApi.js',
  logs: 'src/utils/commons/logColor.js',
  text: 'src/utils/commons/codeSymbol.js',
  layouts: 'src/layouts/index.js',
  feedbacks: 'src/feedbacks/index.js',
  metrics: 'src/components/commons/Metrics/index.js',
  diff: 'src/components/commons/DiffView/index.js',
  highlight: 'src/utils/commons/highlight.js',
}

export function defineToolConfig({
  outDir,
  apiPath,
  env,
  fallback = 'http://127.0.0.1:8770',
  dedupe = ['vue', '@vueuse/core', '@xterm/xterm', '@xterm/addon-fit'],
  here,
}) {
  // vuetify 的默认入口不带组件，只装了骨架；走带组件的入口，模板里的 v-* 才有人认。
  const requireFrom = createRequire(here)
  const vuetifyEntry = requireFrom.resolve('vuetify/lib/entry-bundler.js')
  // 从包的入口反推共享包根目录：.../lib/web-shared/dist/index.js。
  const sharedRoot = dirname(dirname(requireFrom.resolve('@bash-scripts/web-shared')))
  const sharedAliases = [
    {
      find: /^@bash-scripts\/web-shared$/,
      replacement: resolve(sharedRoot, 'src/index.js'),
    },
    ...Object.entries(SHARED_ENTRIES).map(([name, rel]) => ({
      find: new RegExp(`^@bash-scripts/web-shared/${name}$`),
      replacement: resolve(sharedRoot, rel),
    })),
  ]
  // 开发时代理到各工具 web 的端口，默认值见各自 cache 里的 runner.log。
  const backend = process.env[env] || fallback

  return defineConfig(({ command }) => ({
    plugins: [vue(), tailwind()],
    resolve: {
      alias: [
        ...(command === 'serve' ? sharedAliases : []),
        { find: /^vuetify$/, replacement: vuetifyEntry },
      ],
      // 共用的包是软链进来的，依赖统一用本工程这一份，免得 Vue 出两个实例。
      dedupe,
    },
    // 产物不入库；文件名不带哈希，构建只改动同名文件，不再出现一批重命名。
    base: './',
    build: {
      outDir,
      emptyOutDir: true,
      chunkSizeWarningLimit: 900,
      // 文件名固定，浏览器缓存由服务端的 no-cache 管，换版本不会读到旧文件。
      rolldownOptions: {
        output: {
          entryFileNames: 'assets/[name].js',
          chunkFileNames: 'assets/[name].js',
          assetFileNames: 'assets/[name][extname]',
          // 第三方依赖单独成块：它们很少变，换版本时浏览器只用重下业务代码。
          advancedChunks: {
            groups: [
              // Excel 解析只在打开表格时加载，别被下面的 vendor 组并进首包。
              { name: 'exceljs', test: /node_modules\/exceljs\// },
              { name: 'ui', test: /node_modules\/(vue|@vue|vuetify|pinia|@vueuse)\// },
              { name: 'highlight', test: /node_modules\/highlight\.js\// },
              { name: 'charts', test: /node_modules\/(echarts|zrender)\// },
              { name: 'terminal', test: /node_modules\/@xterm\// },
              { name: 'vendor', test: /node_modules\// },
            ],
          },
        },
      },
    },
    server: {
      // 共用的包在 lib/web-shared，开发时要读仓库里这一层。
      fs: { allow: ['../..'] },
      proxy: {
        // 保留浏览器的 Host：后端把 Origin 与 Host 对比来挡跨站写请求，改写了就一律 403。
        [apiPath]: { target: backend, changeOrigin: false },
      },
    },
  }))
}

