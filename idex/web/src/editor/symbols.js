/*
 * @Author: Himmeltala
 * @Date: 2026-11-24 16:05:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 16:05:00
 * @FilePath: \idex\web\src\editor\symbols.js
 * @Description: LSP 符号类型图标与服务端动作标题，和具体语言无关。
 */

export const SYMBOL_ICONS = {
  class: 'mdi-format-letter-case', interface: 'mdi-connection',
  enum: 'mdi-format-list-numbered', function: 'mdi-function',
  method: 'mdi-function-variant', constructor: 'mdi-hammer-wrench',
  variable: 'mdi-variable', constant: 'mdi-variable-box', property: 'mdi-tag-outline',
  field: 'mdi-tag', namespace: 'mdi-folder-outline', module: 'mdi-package-variant',
  struct: 'mdi-cube-outline', typeParameter: 'mdi-generic',
}

export const SYMBOL_TITLES = {
  definition: '定义',
  typeDefinition: '类型定义',
  implementation: '实现',
  references: '引用',
}
