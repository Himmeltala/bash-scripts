/*
 * @Author: Himmeltala
 * @Date: 2026-11-25 11:00:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-25 11:00:00
 * @FilePath: \idex\web\src\features\editor\core\editorBase.js
 * @Description: 单栏与合并差异编辑器共用的位置、诊断、minimap、定位与格式化小工具。
 */
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { setDiagnostics } from '@codemirror/lint'
import { showMinimap } from '@replit/codemirror-minimap'
import { offsetAt } from './positions.js'

export const SEARCH_PHRASES = EditorState.phrases.of({
  Find: '查找',
  Replace: '替换',
  next: '下一个',
  previous: '上一个',
  all: '全部',
  'match case': '区分大小写',
  regexp: '正则表达式',
  'by word': '整词',
  replace: '替换',
  'replace all': '全部替换',
  close: '关闭',
})

// 偏移量到 0 起行列，不复制整份文档。
export function positionOfDoc(doc, offset) {
  const safe = Math.max(0, Math.min(Number(offset) || 0, doc.length))
  const line = doc.lineAt(safe)
  return { line: line.number - 1, character: safe - line.from, offset: safe }
}

export function minimapExtension(enabled) {
  return showMinimap.compute(['doc'], () => {
    if (!enabled) return null
    return {
      create: () => {
        const dom = document.createElement('div')
        dom.className = 'cm-minimap-box'
        return { dom }
      },
      displayText: 'blocks',
      showOverlay: 'mouse-over',
    }
  })
}

export function pushDiagnostics(view, markers) {
  if (!view) return
  const items = []
  for (const [key, level] of Object.entries(markers || {})) {
    const number = Number(key)
    if (!Number.isInteger(number) || number < 1 || number > view.state.doc.lines) continue
    const line = view.state.doc.line(number)
    items.push({
      from: line.from,
      to: line.to,
      severity: level === 'error' ? 'error' : level === 'warning' ? 'warning' : 'info',
      message: '',
    })
  }
  view.dispatch(setDiagnostics(view.state, items))
}

export function locateInView(view, line) {
  if (!view) return
  const number = Math.min(Math.max(Number(line) || 1, 1), view.state.doc.lines)
  const target = view.state.doc.line(number)
  view.focus()
  view.dispatch({
    selection: { anchor: target.from, head: target.to },
    effects: EditorView.scrollIntoView(target.from, { y: 'start' }),
  })
}

export function resetViewScroll(view) {
  if (!view) return
  view.scrollDOM.scrollTop = 0
  view.scrollDOM.scrollLeft = 0
}

export function formatChanges(text, edits) {
  return edits
    .map((edit) => ({
      from: offsetAt(text, edit.start.line, edit.start.character),
      to: offsetAt(text, edit.end.line, edit.end.character),
      insert: String(edit.newText ?? ''),
    }))
    .sort((left, right) => left.from - right.from || left.to - right.to)
}
