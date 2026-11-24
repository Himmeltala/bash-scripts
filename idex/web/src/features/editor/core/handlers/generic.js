/*
 * @Author: Himmeltala
 * @Date: 2026-11-24 16:05:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 21:41:59
 * @FilePath: \idex\web\src\features\editor\core\handlers\generic.js
 * @Description: 没有语言服务器的文件的兜底处理器：只保留语言名与语法着色。
 */
import { extensionOf } from './extension.js'

const LABELS = {
  js: 'JavaScript', jsx: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript',
  ts: 'TypeScript', tsx: 'TypeScript', vue: 'Vue', py: 'Python', pyi: 'Python',
  sh: 'Shell', bash: 'Shell', zsh: 'Shell', java: 'Java', json: 'JSON',
  md: 'Markdown', css: 'CSS', scss: 'SCSS', html: 'HTML', xml: 'XML',
  yml: 'YAML', yaml: 'YAML', sql: 'SQL', go: 'Go', rs: 'Rust', c: 'C',
  h: 'C', cpp: 'C++', hpp: 'C++', cs: 'C#', rb: 'Ruby', php: 'PHP', kt: 'Kotlin',
}

const CM_LANGUAGES = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'jsx',
  ts: 'typescript',
  tsx: 'tsx',
  vue: 'vue',
  html: 'html',
  htm: 'html',
  xml: 'xml',
  svg: 'xml',
  json: 'json',
  css: 'css',
  scss: 'scss',
  less: 'less',
  java: 'java',
  py: 'python',
  pyi: 'python',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  sql: 'sql',
  yml: 'yaml',
  yaml: 'yaml',
  md: 'markdown',
  markdown: 'markdown',
  ini: 'ini',
  conf: 'ini',
  env: 'ini',
  properties: 'properties',
}

export default {
  id: 'generic',
  title: '纯文本',
  extensions: [],
  label(path) {
    const ext = extensionOf(path)
    return (ext && LABELS[ext]) || (ext ? ext.toUpperCase() : '文本')
  },
  server: null,
  cmLanguage(path) {
    return CM_LANGUAGES[extensionOf(path)] || ''
  },
  formatOptions() {
    return { tabSize: 4, insertSpaces: true }
  },
}
