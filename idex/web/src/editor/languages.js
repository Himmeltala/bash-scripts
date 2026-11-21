// 扩展名到 CodeMirror 语言键的映射；认不出的按纯文本打开。

import { javascript } from '@codemirror/lang-javascript'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { json } from '@codemirror/lang-json'
import { java } from '@codemirror/lang-java'
import { python } from '@codemirror/lang-python'
import { sql } from '@codemirror/lang-sql'
import { yaml } from '@codemirror/lang-yaml'
import { markdown } from '@codemirror/lang-markdown'
import { xml } from '@codemirror/lang-xml'
import { sass } from '@codemirror/lang-sass'
import { less } from '@codemirror/lang-less'
import { vue } from '@codemirror/lang-vue'
import { StreamLanguage } from '@codemirror/language'
import { shell } from '@codemirror/legacy-modes/mode/shell'
import { properties } from '@codemirror/legacy-modes/mode/properties'

const BY_EXT = {
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

const EXTENSIONS = {
  javascript: () => javascript(),
  jsx: () => javascript({ jsx: true }),
  typescript: () => javascript({ typescript: true }),
  tsx: () => javascript({ typescript: true, jsx: true }),
  vue: () => vue(),
  html: () => html(),
  xml: () => xml(),
  json: () => json(),
  css: () => css(),
  scss: () => sass(),
  less: () => less(),
  java: () => java(),
  python: () => python(),
  shell: () => StreamLanguage.define(shell),
  sql: () => sql(),
  yaml: () => yaml(),
  markdown: () => markdown(),
  ini: () => StreamLanguage.define(properties),
  properties: () => StreamLanguage.define(properties),
}

export function cmLanguageOf(path) {
  const name = String(path || '').split('/').pop() || ''
  const dot = name.lastIndexOf('.')
  if (dot < 0) return ''
  return BY_EXT[name.slice(dot + 1).toLowerCase()] || ''
}

export function languageExtension(key) {
  const make = EXTENSIONS[key]
  return make ? [make()] : []
}
