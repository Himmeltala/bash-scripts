/*
 * @Author: Himmeltala
 * @Date: 2026-11-24 16:05:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 16:05:00
 * @FilePath: \idex\web\src\editor\languageExtension.js
 * @Description: CodeMirror 语言键到语言扩展的映射；认不出的返回空数组。
 */
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

export function languageExtension(key) {
  const make = EXTENSIONS[key]
  return make ? [make()] : []
}
