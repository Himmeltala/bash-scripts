import { computed } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'

// 当前停在哪个栏目：脚本或压缩，记在浏览器里，刷新后还停在原处。
const TAB_KEY = 'nodex.active-tab'
const TABS = ['scripts', 'zip']

export const usePreferencesStore = defineStore('preferences', () => {
  const savedTab = useLocalStorage(TAB_KEY, 'scripts', { writeDefaults: false })

  // 只认这两个栏目的值，存着别的就回到脚本栏。
  const activeTab = computed({
    get: () => (TABS.includes(savedTab.value) ? savedTab.value : 'scripts'),
    set: (value) => {
      savedTab.value = value
    },
  })
  return { activeTab }
})
