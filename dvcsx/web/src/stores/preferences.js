import { computed } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'

// 变更清单的查看方式在所有工作区之间共用，并记在浏览器里。
const MODE_KEY = 'dvcsx.changes-mode'
// 差异的显示口径：只看改动的片段，或连整份文件一起看。
const SCOPE_KEY = 'dvcsx.diff-scope'
// 浏览目录的搜索口径：按文件名找还是按内容找。
const SEARCH_KEY = 'dvcsx.search-mode'
// 当前停在哪个页签：变更、提交日志、同步或浏览目录。
const TAB_KEY = 'dvcsx.active-tab'
const TABS = ['changes', 'log', 'sync', 'browse']
// 提交日志里「改动的文件」的查看方式：平铺或目录树。
const LOG_FILES_KEY = 'dvcsx.log-files-mode'
// 提交日志的差异口径：只看改动的片段，或连整份文件一起看。
const LOG_SCOPE_KEY = 'dvcsx.log-diff-scope'

export const usePreferencesStore = defineStore('preferences', () => {
  const saved = useLocalStorage(MODE_KEY, 'flat', { writeDefaults: false })
  const savedScope = useLocalStorage(SCOPE_KEY, 'hunks', { writeDefaults: false })
  const savedSearch = useLocalStorage(SEARCH_KEY, 'name', { writeDefaults: false })
  const savedTab = useLocalStorage(TAB_KEY, 'changes', { writeDefaults: false })
  const savedLogFiles = useLocalStorage(LOG_FILES_KEY, 'flat', { writeDefaults: false })
  const savedLogScope = useLocalStorage(LOG_SCOPE_KEY, 'hunks', { writeDefaults: false })

  // 只认 tree 与 flat，存着别的值就按平铺处理。
  const changesMode = computed({
    get: () => (saved.value === 'tree' ? 'tree' : 'flat'),
    set: (value) => {
      saved.value = value
    },
  })
  // 只认 file 与 hunks，存着别的值就按只看改动处理。
  const diffScope = computed({
    get: () => (savedScope.value === 'file' ? 'file' : 'hunks'),
    set: (value) => {
      savedScope.value = value
    },
  })
  // 只认 content 与 name，存着别的值就按文件名找。
  const searchMode = computed({
    get: () => (savedSearch.value === 'content' ? 'content' : 'name'),
    set: (value) => {
      savedSearch.value = value
    },
  })
  // 只认四个页签的值，存着别的就回到变更页。
  const activeTab = computed({
    get: () => (TABS.includes(savedTab.value) ? savedTab.value : 'changes'),
    set: (value) => {
      savedTab.value = value
    },
  })
  // 只认 tree 与 flat，存着别的值就按平铺处理。
  const logFilesMode = computed({
    get: () => (savedLogFiles.value === 'tree' ? 'tree' : 'flat'),
    set: (value) => {
      savedLogFiles.value = value
    },
  })
  // 只认 file 与 hunks，存着别的值就按只看改动处理。
  const logDiffScope = computed({
    get: () => (savedLogScope.value === 'file' ? 'file' : 'hunks'),
    set: (value) => {
      savedLogScope.value = value
    },
  })
  return { changesMode, diffScope, searchMode, activeTab, logFilesMode, logDiffScope }
})
