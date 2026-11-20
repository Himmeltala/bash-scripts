import { defineStore } from 'pinia'
import { useStoredChoice } from '@bash-scripts/web-shared'

// 当前停在哪个栏目：启动服务、打包、安装、模块清单、运行、构建。
export const usePreferencesStore = defineStore('preferences', () => {
  const activeTab = useStoredChoice(
    'jvmx.active-tab',
    ['service', 'package', 'install', 'poms', 'run', 'build'],
    'service'
  )
  return { activeTab }
})
