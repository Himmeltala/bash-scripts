/*
 * @Author: Himmeltala
 * @Date: 2026-11-26 23:20:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-26 23:20:00
 * @FilePath: \idex\web\src\features\editor\core\fonts.js
 * @Description: 编辑器字体：写根节点 CSS 变量，所有 CodeMirror 实例跟着变；与终端字体分开。
 */

// 服务端读不到设置时的回退值，和服务端默认保持一致。
export const EDITOR_FONT_FALLBACK = {
  font_family:
    "'JetBrains Mono', Roboto, 'Noto Sans SC', 'Source Han Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif",
  font_size: 14,
  line_height: 1.6,
  font_weight: 'normal',
  letter_spacing: 0,
}

// theme 里的 .cm-scroller 读这几个变量；变量没设时退回应用默认等宽字体。
export function applyEditorFont(font) {
  const value = { ...EDITOR_FONT_FALLBACK, ...(font || {}) }
  const root = document.documentElement
  root.style.setProperty('--idex-editor-font', value.font_family || EDITOR_FONT_FALLBACK.font_family)
  root.style.setProperty('--idex-editor-size', `${value.font_size || EDITOR_FONT_FALLBACK.font_size}px`)
  root.style.setProperty('--idex-editor-line-height', String(value.line_height || EDITOR_FONT_FALLBACK.line_height))
  root.style.setProperty('--idex-editor-weight', value.font_weight || 'normal')
  root.style.setProperty('--idex-editor-letter-spacing', `${value.letter_spacing || 0}px`)
}
