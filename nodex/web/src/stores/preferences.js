import { defineStore } from 'pinia'
import { useStoredChoice } from '@bash-scripts/web-shared'

// 当前停在哪个栏目：脚本或压缩，记在浏览器里，刷新后还停在原处。
export const usePreferencesStore = defineStore('preferences', () => {
  const activeTab = useStoredChoice('nodex.active-tab', ['scripts', 'zip'], 'scripts')
  return { activeTab }
})
