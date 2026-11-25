/*
 * @Author: Himmeltala
 * @Date: 2026-11-25 00:00:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-25 00:00:00
 * @FilePath: \idex\web\src\features\editor\composables\useEditorFind.js
 * @Description: 编辑器查找条的状态与操作，底层用 CodeMirror 的搜索插件。
 */
import { reactive } from 'vue'
import {
  SearchQuery,
  findNext,
  findPrevious,
  replaceAll,
  replaceNext,
  setSearchQuery,
} from '@codemirror/search'

export function useEditorFind(getView) {
  const find = reactive({ open: false, text: '', replace: '', showReplace: false, count: '' })

  function query() {
    return new SearchQuery({ search: find.text, replace: find.replace, caseSensitive: false })
  }

  function updateCount() {
    const view = getView()
    if (!view || !find.text) {
      find.count = ''
      return
    }
    let total = 0
    const cursor = query().getCursor(view.state)
    while (!cursor.next().done) {
      total += 1
      if (total > 999) break
    }
    find.count = total ? `${total} 处` : '没找到'
  }

  function refresh() {
    const view = getView()
    if (!view) return
    view.dispatch({ effects: setSearchQuery.of(query()) })
    updateCount()
  }

  function open() {
    const view = getView()
    if (view) {
      const selection = view.state.selection.main
      const raw = selection.empty ? '' : view.state.sliceDoc(selection.from, selection.to)
      if (raw && !raw.includes('\n')) find.text = raw
    }
    find.open = true
    refresh()
  }

  function close() {
    find.open = false
    find.showReplace = false
    const view = getView()
    if (view) {
      view.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: '' })) })
      view.focus()
    }
  }

  function step(direction) {
    const view = getView()
    if (!view) return
    refresh()
    const hit = direction > 0 ? findNext(view) : findPrevious(view)
    find.count = hit ? find.count : '没找到'
  }

  function replaceOne() {
    const view = getView()
    if (!view) return
    refresh()
    replaceNext(view)
    refresh()
  }

  function replaceEvery() {
    const view = getView()
    if (!view) return
    refresh()
    replaceAll(view)
    refresh()
  }

  return { find, open, close, step, replaceOne, replaceEvery, refresh }
}
