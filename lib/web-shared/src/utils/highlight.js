// 代码查看用的语法着色：只注册常见语言，不把整个 highlight.js 打进包里。

import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import css from 'highlight.js/lib/languages/css'
import ini from 'highlight.js/lib/languages/ini'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import markdown from 'highlight.js/lib/languages/markdown'
import python from 'highlight.js/lib/languages/python'
import sql from 'highlight.js/lib/languages/sql'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'

const LANGUAGES = { bash, css, ini, java, javascript, json, markdown, python, sql, typescript, xml, yaml }
for (const [name, def] of Object.entries(LANGUAGES)) hljs.registerLanguage(name, def)

// 扩展名到语言名，不认识的按纯文本显示。
const BY_EXT = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  vue: 'xml',
  html: 'xml',
  htm: 'xml',
  xml: 'xml',
  svg: 'xml',
  json: 'json',
  css: 'css',
  scss: 'css',
  less: 'css',
  java: 'java',
  py: 'python',
  sh: 'bash',
  bash: 'bash',
  sql: 'sql',
  yml: 'yaml',
  yaml: 'yaml',
  md: 'markdown',
  markdown: 'markdown',
  ini: 'ini',
  properties: 'ini',
  conf: 'ini',
  env: 'ini',
}

// 整份着色很吃时间，超过这个长度按纯文本显示。
export const MAX_HIGHLIGHT = 200 * 1024

export function languageOf(path) {
  const name = String(path || '').split('/').pop() || ''
  const dot = name.lastIndexOf('.')
  if (dot < 0) return ''
  return BY_EXT[name.slice(dot + 1).toLowerCase()] || ''
}

function escapeHtml(text) {
  return text.replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch])
}

export function highlightCode(text, language) {
  if (!text) return ''
  if (!language || text.length > MAX_HIGHLIGHT) return escapeHtml(text)
  try {
    return hljs.highlight(text, { language, ignoreIllegals: true }).value
  } catch (err) {
    return escapeHtml(text)
  }
}
