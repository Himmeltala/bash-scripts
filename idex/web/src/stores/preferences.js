/*
 * @Author: Himmeltala
 * @Date: 2026-11-23 23:09:19
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 22:08:05
 * @FilePath: \idex\web\src\stores\preferences.js
 * @Description: idex 的界面偏好：变更、差异、搜索、页签与编辑器配色的本地选择。
*/

import { defineStore } from 'pinia'
import { useStoredChoice } from '@bash-scripts/web-shared'
import { EDITOR_THEME_IDS } from '../features/editor/core/themeOptions'

// 变更清单、差异、搜索与页签的查看方式，都记在浏览器里，换工作区保持不变。
export const usePreferencesStore = defineStore('preferences', () => {
  const changesMode = useStoredChoice('idex.changes-mode', ['tree', 'flat'], 'flat')
  const diffScope = useStoredChoice('idex.diff-scope', ['file', 'hunks'], 'hunks')
  const searchMode = useStoredChoice('idex.search-mode', ['content', 'name'], 'name')
  const activeTab = useStoredChoice('idex.active-tab', ['changes', 'log', 'browse', 'node', 'jvm'], 'changes')
  const logFilesMode = useStoredChoice('idex.log-files-mode', ['tree', 'flat'], 'flat')
  const logDiffScope = useStoredChoice('idex.log-diff-scope', ['file', 'hunks'], 'hunks')
  // 代码编辑器的配色只影响浏览页，跟随界面与四套固定预设。
  const editorTheme = useStoredChoice('idex.editor-theme', EDITOR_THEME_IDS, 'auto')
  return { changesMode, diffScope, searchMode, activeTab, logFilesMode, logDiffScope, editorTheme }
})
