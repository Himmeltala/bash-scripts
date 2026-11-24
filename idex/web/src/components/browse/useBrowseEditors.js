/*
 * @Author: Himmeltala
 * @Date: 2026-11-20 01:50:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-20 01:50:00
 * @FilePath: \idex\web\src\components\browse\useBrowseEditors.js
 * @Description: 浏览页的页签、编辑器实例与未保存草稿，按工作区恢复。
 */
import { computed, nextTick, ref } from 'vue'
import { closeTab as closeTabIn, openTab as openTabIn, tabOf, updateTab } from './browseTabs.js'

export function useBrowseEditors({ kept, refreshDiagnostics, onLoaded }) {
  // 打开过的文件各占一个页签，每个页签一个编辑器实例：草稿、视图与滚动都留在各自那份里。
  const tabs = ref(kept ? kept.tabs : [])
  const activePath = ref(kept ? kept.active : '')
  const drafts = new Map(kept && kept.drafts ? kept.drafts : [])
  const editors = new Map()
  const activeTab = computed(() => tabOf(tabs.value, activePath.value))

  // 页签与编辑器实例对起来：挂载时登记，卸载时按挂载时那个路径注销。
  function setEditor(path, el) {
    if (el) editors.set(path, el)
    else editors.delete(path)
  }

  function editorOf(path) {
    return editors.get(path) || null
  }

  // 换走时把还活着的编辑器里的草稿取出来；还没读过内容的页签不动，草稿本来就还在。
  function takeDrafts() {
    for (const tab of tabs.value) {
      const editor = editorOf(tab.path)
      if (!editor || !editor.path) continue
      if (editor.dirty) drafts.set(tab.path, editor.text)
      else drafts.delete(tab.path)
    }
  }

  // 回到旧页签：文件读进来之后把草稿放回去，未保存标记跟着回来。
  // 磁盘上已经是这份草稿时不用放，标记也要落回干净，别留着一个假的未保存。
  function restoreDraft(path, editor) {
    const text = drafts.get(path)
    if (text !== undefined && editor.text !== text) editor.restore(text)
    setDirty(path, editor.dirty)
  }

  function setDirty(path, on) {
    const tab = tabOf(tabs.value, path)
    if (!tab || tab.dirty === on) return
    tabs.value = updateTab(tabs.value, path, { dirty: on })
  }

  // 打开文件：已经开着就切过去，草稿、视图与滚动都还留在那个实例里；没开过就新加一个页签。
  async function show(node, line = 0) {
    const found = tabOf(tabs.value, node.path)
    if (!found) tabs.value = openTabIn(tabs.value, node)
    else if (node.size !== undefined && node.size !== found.size) {
      tabs.value = updateTab(tabs.value, node.path, { size: node.size })
    }
    activePath.value = node.path
    await nextTick()
    const editor = editorOf(node.path)
    // 过大文件只有下载占位，没有编辑器可开。
    if (!editor) return
    refreshDiagnostics(node.path)
    // 实例还没读过内容（新页签、回到旧页签，或刚从过大文件的占位换回编辑器），读一遍。
    if (!editor.path) {
      if (await editor.open(node.path, line)) {
        restoreDraft(node.path, editor)
        if (onLoaded) onLoaded(node.path)
      }
      return
    }
    if (!line) return
    // 跳行要按新位置重读文件，草稿还在就先问一句。
    if (editor.dirty && !(await editor.confirmLeave())) return
    if (await editor.open(node.path, line) && onLoaded) onLoaded(node.path)
  }

  // 点开另一个页签：回到旧工作区时只读过停着的那一个，其余的等点到再读。
  async function activate(tab) {
    activePath.value = tab.path
    await nextTick()
    const editor = editorOf(tab.path)
    if (!editor || editor.path) return
    if (await editor.open(tab.path)) {
      restoreDraft(tab.path, editor)
      if (onLoaded) onLoaded(tab.path)
    }
    refreshDiagnostics(tab.path)
  }

  // 关页签：没保存的问一句再关，关的是当前就停到旁边那个。
  async function closeTab(tab) {
    const editor = editorOf(tab.path)
    if (editor && editor.dirty && !(await editor.confirmLeave())) return
    const before = activePath.value
    const result = closeTabIn(tabs.value, tab.path, before)
    tabs.value = result.tabs
    drafts.delete(tab.path)
    if (result.active !== before) activePath.value = result.active
  }

  return {
    tabs,
    activePath,
    activeTab,
    drafts,
    editorOf,
    setEditor,
    takeDrafts,
    restoreDraft,
    setDirty,
    show,
    activate,
    closeTab,
  }
}
