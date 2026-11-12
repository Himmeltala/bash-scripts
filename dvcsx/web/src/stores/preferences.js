import { computed } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'

// 变更清单的查看方式在所有工作区之间共用，并记在浏览器里。
const MODE_KEY = 'dvcsx.changes-mode'

export const usePreferencesStore = defineStore('preferences', () => {
  const saved = useLocalStorage(MODE_KEY, 'flat', { writeDefaults: false })

  // 只认 tree 与 flat，存着别的值就按平铺处理。
  const changesMode = computed({
    get: () => (saved.value === 'tree' ? 'tree' : 'flat'),
    set: (value) => {
      saved.value = value
    },
  })
  return { changesMode }
})
