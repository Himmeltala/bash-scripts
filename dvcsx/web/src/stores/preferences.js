import { ref, watch } from 'vue'
import { defineStore } from 'pinia'

// 变更清单的查看方式在所有工作区之间共用，并记在浏览器里。
const MODE_KEY = 'dvcsx.changes-mode'

function readMode() {
  try {
    return localStorage.getItem(MODE_KEY) === 'tree' ? 'tree' : 'flat'
  } catch (err) {
    return 'flat'
  }
}

export const usePreferencesStore = defineStore('preferences', () => {
  const changesMode = ref(readMode())
  watch(changesMode, (value) => {
    try {
      localStorage.setItem(MODE_KEY, value)
    } catch (err) {
      // 隐私模式或存储被禁用时只在本次会话里生效。
    }
  })
  return { changesMode }
})
