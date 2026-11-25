/*
 * @Author: Himmeltala
 * @Date: 2026-11-23 23:09:19
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-25 08:31:41
 * @FilePath: \idex\web\src\stores\preferences.js
 * @Description: idex 的界面偏好：变更、差异、搜索、页签与编辑器配色的本地选择。
*/

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { useStoredChoice } from '@bash-scripts/web-shared'
import { EDITOR_THEME_IDS } from '../features/editor/core/themeOptions'
import { SHORTCUT_DEFAULTS } from '../features/settings/lib/shortcuts'

// 变更清单、差异、搜索与页签的查看方式，都记在浏览器里，换工作区保持不变。
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
  // 代码编辑器的配色只影响浏览页，跟随界面与四套固定预设。
  const editorTheme = useStoredChoice('idex.editor-theme', EDITOR_THEME_IDS, 'auto')
  // 编辑器右侧的代码地图，同样由服务端设置加载。
  const minimap = ref(false)
  // 快捷键绑定，由服务端设置加载，各处按键处理都读这一份。
  const shortcuts = ref({ ...SHORTCUT_DEFAULTS })
  // 底部终端面板的展开状态与高度只管这一台浏览器。
  const terminalOpen = useLocalStorage('idex.terminal-open', false)
  const terminalHeight = useLocalStorage('idex.terminal-height', 280)
  // 从其他页签跳到资源管理器某个文件：{ path, line, seq }，消费后清空。
  const pendingOpen = ref(null)
  // 全局搜索快捷键带来的请求：{ mode, seq }，资源管理器消费后清空。
  const pendingSearch = ref(null)
  return { changesMode, diffScope, changesDiffInline, searchMode, activeTab, logFilesMode, logDiffScope, logDiffInline, editorTheme, minimap, shortcuts, terminalOpen, terminalHeight, pendingOpen, pendingSearch }
})
