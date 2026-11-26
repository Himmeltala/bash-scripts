/*
 * @Author: Himmeltala
 * @Date: 2026-11-26 09:26:41
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-26 09:26:41
 * @FilePath: \idex\web\vite.config.js
 * @Description: idex 前端的 Vite 配置，代理接口到本机后端。
 */
import { defineToolConfig } from '@bash-scripts/web-shared/vite-preset'

// 开发时代理到 idex web 的端口（默认 8771，见 ~/.cache/idex/web/runner.log 里的地址）。
export default defineToolConfig({
  here: import.meta.url,
  outDir: 'dist',
  apiPath: '/__idex/api',
  env: 'IDEX_WEB_ORIGIN',
  fallback: 'http://127.0.0.1:8771',
  dedupe: ['vue', '@vueuse/core', '@xterm/xterm', '@xterm/addon-fit', 'highlight.js'],
})
