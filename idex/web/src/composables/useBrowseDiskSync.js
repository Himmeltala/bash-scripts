/*
 * @Author: Himmeltala
 * @Date: 2026-11-20 16:30:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-20 16:30:00
 * @FilePath: \idex\web\src\composables\useBrowseDiskSync.js
 * @Description: 浏览页跟随磁盘变化：外部改动后重读展开的层，打开的文件只打标记，点页签才换内容。
 */
import { onBeforeUnmount, ref, watch } from 'vue'
import { tabOf, updateTab } from '../utils/browseTabs.js'

export function useBrowseDiskSync({
  refresh,
  tabs,
  activeTab,
  editorOf,
  loadFile,
  refreshDiagnostics,
  activate,
  searching,
  treeRef,
}) {
  let refreshTimer = 0
  // 每轮重读算一代；页签记着自己在哪一代核对过磁盘内容。
  const diskSeq = ref(0)
  let searchStale = false

  function markSynced(path) {
    const tab = tabOf(tabs.value, path)
    if (!tab) return
    if (tab.stale || tab.diskSeq !== diskSeq.value) {
      tabs.value = updateTab(tabs.value, path, { stale: false, diskSeq: diskSeq.value })
    }
  }

  // 磁盘上的这份和编辑器里的底稿比：true 一致、false 改过、null 读不了。
  async function diskSameAsBase(tab) {
    const editor = editorOf(tab.path)
    if (!editor || !editor.path) return null
    let text
    try {
      const data = await loadFile(tab.path)
      text = (data.text || '').replace(/\r\n?/g, '\n')
    } catch (err) {
      return null
    }
    return text === editor.base
  }

  // 当前这个文件只做标记：正在读的那份不打断，点页签才换。
  async function markActiveStale() {
    const tab = activeTab.value
    if (!tab || tab.diskSeq === diskSeq.value) return
    const same = await diskSameAsBase(tab)
    if (same === true) markSynced(tab.path)
    else if (same === false) tabs.value = updateTab(tabs.value, tab.path, { stale: true })
  }

  // 点页签时重读：没改过直接换上新内容，有草稿的先问。
  async function loadIfChanged(tab) {
    const editor = editorOf(tab.path)
    if (!editor || !editor.path || tab.diskSeq === diskSeq.value) return
    const same = await diskSameAsBase(tab)
    if (same !== false) {
      if (same === true) markSynced(tab.path)
      return
    }
    if (editor.dirty && !(await editor.confirmLeave())) return
    if (await editor.open(tab.path)) {
      markSynced(tab.path)
      refreshDiagnostics(tab.path)
    }
  }

  async function activateTab(tab) {
    await loadIfChanged(tab)
    await activate(tab)
  }

  async function runAutoRefresh() {
    refreshTimer = 0
    diskSeq.value += 1
    if (searching.value) {
      // 搜索结果占着左栏，目录树先不读；退出搜索时补一次。
      searchStale = true
    } else {
      await treeRef.value?.reloadExpanded()
    }
    await markActiveStale()
  }

  // 连续变化（构建、批量生成）合并成一轮，别一条事件就读一遍目录。
  function scheduleAutoRefresh() {
    if (refreshTimer) return
    refreshTimer = setTimeout(runAutoRefresh, 1200)
  }

  // 退出搜索时把攒下的那一轮补上。
  function flushSearchStale() {
    if (!searchStale) return
    searchStale = false
    treeRef.value?.reloadExpanded()
  }

  watch(refresh, () => scheduleAutoRefresh())
  onBeforeUnmount(() => {
    clearTimeout(refreshTimer)
  })

  return { markSynced, loadIfChanged, activateTab, flushSearchStale }
}
