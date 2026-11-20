import { defineStore } from 'pinia'
import { useStoredChoice } from '@bash-scripts/web-shared'

// 变更清单、差异、搜索与页签的查看方式，都记在浏览器里，换工作区保持不变。
export const usePreferencesStore = defineStore('preferences', () => {
  const changesMode = useStoredChoice('idex.changes-mode', ['tree', 'flat'], 'flat')
  const diffScope = useStoredChoice('idex.diff-scope', ['file', 'hunks'], 'hunks')
  const searchMode = useStoredChoice('idex.search-mode', ['content', 'name'], 'name')
  const activeTab = useStoredChoice('idex.active-tab', ['changes', 'log', 'sync', 'browse'], 'changes')
  const logFilesMode = useStoredChoice('idex.log-files-mode', ['tree', 'flat'], 'flat')
  const logDiffScope = useStoredChoice('idex.log-diff-scope', ['file', 'hunks'], 'hunks')
  return { changesMode, diffScope, searchMode, activeTab, logFilesMode, logDiffScope }
})
