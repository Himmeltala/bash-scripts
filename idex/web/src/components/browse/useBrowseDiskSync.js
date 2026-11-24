/*
 * @Author: Himmeltala
 * @Date: 2026-11-20 16:30:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 09:23:31
 * @FilePath: \idex\web\src\components\browse\useBrowseDiskSync.js
 * @Description: 浏览页跟随磁盘变化：外部改动后只重读改动所在层，打开的文件先比修改时间。
 */
import { onBeforeUnmount, ref, watch } from 'vue'
import { tabOf, updateTab } from './browseTabs.js'

// 服务端一轮最多带这么多条路径；到上限就当作不知道具体位置，整棵展开树重读。
const CHANGED_PATHS_LIMIT = 500

// 文件所在的层与各级上级：删掉整个目录时，只有重读上级那层才能把旧行去掉。
function dirsOf(path) {
  const dirs = []
  let rest = String(path || '')
  while (true) {
    const index = rest.lastIndexOf('/')
    if (index < 0) break
    rest = rest.slice(0, index)
    dirs.push(rest)
  }
  dirs.push('')
  return dirs
}

export function useBrowseDiskSync({
  refresh,
  changedPaths = () => [],
  tabs,
  activeTab,
  editorOf,
  loadFile,
  statFile,
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
  // 先看修改时间与大小，没换就不拉正文。
  async function diskSameAsBase(tab) {
    const editor = editorOf(tab.path)
    if (!editor || !editor.path) return null
    if (statFile && tab.mtimeNs) {
      try {
        const info = await statFile(tab.path)
        if (info.mtime_ns === tab.mtimeNs && info.size === tab.size) return true
      } catch (err) {
        return null
      }
    }
    let text
    try {
      const data = await loadFile(tab.path)
      text = (data.text || '').replace(/\r\n?/g, '\n')
      if (data.mtime_ns !== undefined) {
        tabs.value = updateTab(tabs.value, tab.path, { mtimeNs: data.mtime_ns, size: data.size })
      }
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
    const paths = (changedPaths() || []).filter(Boolean)
    const known = paths.length > 0 && paths.length < CHANGED_PATHS_LIMIT
    if (searching.value) {
      // 搜索结果占着左栏，目录树先不读；退出搜索时补一次。
      searchStale = true
    } else if (known) {
      const dirs = new Set()
      for (const path of paths) {
        for (const dir of dirsOf(path)) dirs.add(dir)
      }
      await treeRef.value?.reloadDirs([...dirs])
    } else {
      await treeRef.value?.reloadExpanded()
    }
    // 知道具体路径就只核对被改到的那份；不知道就照旧核对当前页签。
    if (known && !paths.includes(activeTab.value?.path)) return
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

  return { markSynced, markActiveStale, loadIfChanged, activateTab, flushSearchStale }
}
