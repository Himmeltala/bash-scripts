/*
 * @Author: Himmeltala
 * @Date: 2026-11-20 00:20:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-20 00:20:00
 * @FilePath: \idex\web\src\composables\languageServers.js
 * @Description: 语言、语言服务器与符号图标的对照表。
 */

// 状态栏显示的语言名。
export const LANGUAGES = {
  js: 'JavaScript', jsx: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript',
  ts: 'TypeScript', tsx: 'TypeScript', vue: 'Vue', py: 'Python', pyi: 'Python',
  sh: 'Shell', bash: 'Shell', zsh: 'Shell', java: 'Java', json: 'JSON',
  md: 'Markdown', css: 'CSS', scss: 'SCSS', html: 'HTML', xml: 'XML',
  yml: 'YAML', yaml: 'YAML', sql: 'SQL', go: 'Go', rs: 'Rust', c: 'C',
  h: 'C', cpp: 'C++', hpp: 'C++', cs: 'C#', rb: 'Ruby', php: 'PHP', kt: 'Kotlin',
}

// 扩展名对应的语言服务器 id，跟服务端 SERVERS 的键一致。
export const SERVER_BY_EXT = {
  sh: 'shell', bash: 'shell', zsh: 'shell', py: 'python', pyi: 'python',
  js: 'typescript', jsx: 'typescript', ts: 'typescript', tsx: 'typescript',
  mjs: 'typescript', cjs: 'typescript', vue: 'vue', java: 'java',
}

// LSP 的 SymbolKind 到图标的对照，符号大纲用。
export const SYMBOL_ICONS = {
  class: 'mdi-format-letter-case', interface: 'mdi-connection',
  enum: 'mdi-format-list-numbered', function: 'mdi-function',
  method: 'mdi-function-variant', constructor: 'mdi-hammer-wrench',
  variable: 'mdi-variable', constant: 'mdi-variable-box', property: 'mdi-tag-outline',
  field: 'mdi-tag', namespace: 'mdi-folder-outline', module: 'mdi-package-variant',
  struct: 'mdi-cube-outline', typeParameter: 'mdi-generic',
}

// 代码菜单里走服务端查询的动作，标题也用来拼「没有找到……」的提示。
export const SYMBOL_TITLES = {
  definition: '定义',
  typeDefinition: '类型定义',
  implementation: '实现',
  references: '引用',
}
