/*
 * @Author: Himmeltala
 * @Date: 2026-11-26 09:26:41
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-26 09:26:41
 * @FilePath: \idex\web\src\features\editor\core\setup.js
 * @Description: CodeMirror basicSetup 的本地副本，折叠标记换成 MDI 图标。
 */
// basicSetup 的本地副本：CodeMirror 不开放折叠标记配置，定制要照官方说明复制这份清单。
// 与 basicSetup 的差别只有 foldGutter 的 markerDOM 换成 MDI 图标并写中文标题。

import {
  lineNumbers,
  highlightActiveLineGutter,
  highlightSpecialChars,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  highlightActiveLine,
  keymap,
} from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import {
  foldGutter,
  indentOnInput,
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  foldKeymap,
} from '@codemirror/language'
import { history, defaultKeymap, historyKeymap } from '@codemirror/commands'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import { closeBrackets, autocompletion, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete'
import { lintKeymap } from '@codemirror/lint'

// 折叠箭头的图标；展开态朝下，收起态朝右。
function foldMarker(open) {
  const span = document.createElement('span')
  span.className = 'cm-fold-icon'
  span.title = open ? '折叠' : '展开'
  const icon = document.createElement('i')
  icon.className = `mdi ${open ? 'mdi-chevron-down' : 'mdi-chevron-right'}`
  span.appendChild(icon)
  return span
}

export const editorSetup = [
  lineNumbers(),
  highlightActiveLineGutter(),
  highlightSpecialChars(),
  history(),
  foldGutter({ markerDOM: foldMarker }),
  drawSelection(),
  dropCursor(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  bracketMatching(),
  closeBrackets(),
  autocompletion(),
  rectangularSelection(),
  crosshairCursor(),
  highlightActiveLine(),
  highlightSelectionMatches(),
  keymap.of([
    ...closeBracketsKeymap,
    ...defaultKeymap,
    ...searchKeymap,
    ...historyKeymap,
    ...foldKeymap,
    ...completionKeymap,
    ...lintKeymap,
  ]),
]
