// 四个网页工程共用的 vite 配置：Vue 插件、vuetify 别名、依赖去重、代理与打包目录。
// 调用方把 import.meta.url 传进来，vuetify 从本工程这一份解析，免得出来两个 Vue。

import { createRequire } from 'node:module'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export function toolConfig({
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
  // 开发时代理到各工具 web 的端口，默认值见各自 cache 里的 runner.log。
  const backend = process.env[env] || fallback

  return defineConfig({
    plugins: [vue()],
    resolve: {
      alias: [{ find: /^vuetify$/, replacement: vuetifyEntry }],
      // 共用的包是软链进来的，依赖统一用本工程这一份，免得 Vue 出两个实例。
      dedupe,
    },
    // 产物跟源码一起进仓库，本机不需要 Node 也能用网页。
    base: './',
    build: {
      outDir,
      emptyOutDir: true,
      chunkSizeWarningLimit: 900,
    },
    server: {
      // 共用的包在 lib/web-shared，开发时要读仓库里这一层。
      fs: { allow: ['../..'] },
      proxy: {
        [apiPath]: backend,
      },
    },
  })
}

