import { computed } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'

// 当前停在哪个栏目：Maven 是启动服务、打包、安装、模块清单，Gradle 是启动、构建。
const TAB_KEY = 'jvmx.active-tab'
const TABS = ['service', 'package', 'install', 'poms', 'run', 'build']

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
