/*
 * @Author: Himmeltala
 * @Date: 2026-11-23 23:09:19
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-28 10:45:00
 * @FilePath: \idex\web\src\stores\preferences.js
 * @Description: 本浏览器的界面偏好：变更、差异、搜索与页签的查看方式，只存本地，不上传。
*/

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useStoredChoice } from '@bash-scripts/web-shared'

// 服务端设置（字体、快捷键、顶栏……）在 stores/settings.js；这里只留浏览器查看状态。
export const usePreferencesStore = defineStore('preferences', () => {
  const changesMode = useStoredChoice('idex.changes-mode', ['tree', 'flat'], 'flat')
  const diffScope = useStoredChoice('idex.diff-scope', ['file', 'hunks'], 'hunks')
  const searchMode = useStoredChoice('idex.search-mode', ['content', 'name'], 'name')
  const activeTab = useStoredChoice('idex.active-tab', ['changes', 'log', 'browse', 'node', 'jvm'], 'changes')
  const logFilesMode = useStoredChoice('idex.log-files-mode', ['tree', 'flat'], 'flat')
  const logDiffScope = useStoredChoice('idex.log-diff-scope', ['file', 'hunks'], 'hunks')
  // 差异编辑器默认并排；两个页面各自记住自己的选择。
  const changesDiffInline = useStoredChoice('idex.changes-diff-inline', [false, true], false)
  const logDiffInline = useStoredChoice('idex.log-diff-inline', [false, true], false)
  // 从其他页签跳到资源管理器某个文件：{ path, line, seq }，消费后清空。
  const pendingOpen = ref(null)
  // 全局搜索快捷键带来的请求：{ mode, seq }，资源管理器消费后清空。
  const pendingSearch = ref(null)
  return { changesMode, diffScope, changesDiffInline, searchMode, activeTab, logFilesMode, logDiffScope, logDiffInline, pendingOpen, pendingSearch }
})
