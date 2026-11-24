/*
 * @Author: Himmeltala
 * @Date: 2026-11-24 16:05:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 16:05:00
 * @FilePath: \idex\web\src\editor\handlers\typescript.js
 * @Description: JavaScript 与 TypeScript 共用 typescript-language-server。
 */
import { extensionOf } from './extension.js'

const CM_LANGUAGES = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'jsx',
  ts: 'typescript',
  tsx: 'tsx',
}

export default {
  id: 'typescript',
  title: 'TypeScript',
  extensions: ['js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx'],
  label(path) {
    return ['ts', 'tsx'].includes(extensionOf(path)) ? 'TypeScript' : 'JavaScript'
  },
  server: 'typescript',
  cmLanguage(path) {
    return CM_LANGUAGES[extensionOf(path)] || ''
  },
  formatOptions() {
    return { tabSize: 4, insertSpaces: true }
  },
}
