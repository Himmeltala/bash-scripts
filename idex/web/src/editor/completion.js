// 补全结果转成 CodeMirror 的选项，并提供一个只认最后一次请求的闸门。

import { offsetAt } from './positions.js'

const TYPES = {
  function: 'function',
  method: 'function',
  constructor: 'function',
  variable: 'variable',
  field: 'variable',
  property: 'variable',
  constant: 'variable',
  class: 'class',
  interface: 'class',
  struct: 'class',
  enum: 'class',
  typeParameter: 'class',
  module: 'namespace',
  namespace: 'namespace',
  keyword: 'keyword',
}

function documentationText(value) {
  if (!value) return ''
  if (typeof value === 'string') return value
  return String(value.value || '')
}

function insertTextOf(item) {
  return String(item.insertText || item.label || '')
}

export function snapshotMatches(left, right) {
  return String(left) === String(right)
}

export function textEditChanges(snapshot, current, edit, fallback) {
  if (!snapshotMatches(snapshot, current)) return null
  const from = offsetAt(current, edit.start.line, edit.start.character)
  const to = offsetAt(current, edit.end.line, edit.end.character)
  if (from > to) return null
  return { from, to, insert: String(edit.newText ?? fallback ?? '') }
}

function applyTextEdit(item, snapshot) {
  const edit = item.textEdit
  return (view, _completion, from, to) => {
    const text = view.state.doc.toString()
    const change = textEditChanges(snapshot, text, edit, insertTextOf(item))
    try {
      if (!change) {
        view.dispatch({ changes: { from, to, insert: insertTextOf(item) } })
        return
      }
      view.dispatch({
        changes: change,
        selection: { anchor: change.from + change.insert.length },
      })
    } catch (err) {
      // 服务器给的区间在当前文档上不成立时不落盘。
    }
  }
}

// 光标前的词从哪里开始：成员访问与参数前缀只取最后一段，触发符本身也给一个空锚点。
const WORD_BEFORE = /[\p{L}\p{N}_$@.-]*$/u

export function completionAnchor(text, pos) {
  const source = String(text ?? '')
  const at = Math.max(0, Math.min(Number(pos) || 0, source.length))
  const before = source.slice(0, at)
  const word = (before.match(WORD_BEFORE) || [''])[0]
  const cut = Math.max(word.lastIndexOf('.'), word.lastIndexOf('-'))
  const from = at - word.length + cut + 1
  const previous = before[at - 1]
  return {
    from,
    empty: from === at,
    trigger: from === at && (previous === '.' || previous === '-'),
  }
}

function applyInsertText(item) {
  const insert = insertTextOf(item)
  return (view, _completion, from, to) => {
    try {
      view.dispatch({
        changes: { from, to, insert },
        selection: { anchor: from + insert.length },
      })
    } catch (err) {
      // 当前选区已失效时不动文档。
    }
  }
}

export function completionOptions(items, snapshot = '') {
  return (items || [])
    .filter((item) => item && item.label && !item.additionalTextEdits)
    .map((item) => {
      const option = {
        label: String(item.label),
        type: TYPES[item.kind] || null,
      }
      if (item.detail) option.detail = String(item.detail)
      const info = documentationText(item.documentation)
      if (info) option.info = info
      if (item.textEdit) option.apply = applyTextEdit(item, snapshot)
      else if (item.insertText && item.insertText !== item.label) {
        option.apply = applyInsertText(item)
      }
      return option
    })
}

export function latestRequests() {
  let seq = 0
  return {
    run(fn) {
      const mine = ++seq
      return Promise.resolve()
        .then(fn)
        .then((value) => (mine === seq ? value : undefined))
    },
    cancel() {
      seq += 1
    },
  }
}
