import { computed } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'

// 当前停在哪个栏目：启动服务、打包、安装或模块清单，记在浏览器里，刷新后还停在原处。
const TAB_KEY = 'mvnx.active-tab'
const TABS = ['service', 'package', 'install', 'poms']

export const usePreferencesStore = defineStore('preferences', () => {
  const savedTab = useLocalStorage(TAB_KEY, 'service', { writeDefaults: false })

  // 只认这四个栏目的值，存着别的就回到启动服务栏。
  const activeTab = computed({
    get: () => (TABS.includes(savedTab.value) ? savedTab.value : 'service'),
    set: (value) => {
      savedTab.value = value
    },
  })
  return { activeTab }
})
