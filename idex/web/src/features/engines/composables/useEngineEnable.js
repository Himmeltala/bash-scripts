/*
 * @Author: Himmeltala
 * @Date: 2026-11-23 21:40:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 21:41:59
 * @FilePath: \idex\web\src\features\engines\composables\useEngineEnable.js
 * @Description: 把引擎启用流程接到组件生命周期：登记或报错时放开等待，换工作区与卸载时作废旧请求。
 */
import { onBeforeUnmount, watch } from 'vue'
import { createEngineEnable } from '../lib/engineEnable'

export function useEngineEnable({ registered, error, ...options }) {
  const flow = createEngineEnable({
    ...options,
    isRegistered: () => registered.value,
  })

  // 扫描结果由状态推送带回来：工作区一出现就不用再等。
  watch(registered, (on) => {
    if (on) flow.stopWait(true)
  })

  // 引擎一报错就放开等待，错误块里给重试；恢复后可以再点启用。
  watch(error, (text) => {
    if (text) flow.stopWait()
  })

  watch(options.wsId, () => flow.reset())
  onBeforeUnmount(() => flow.dispose())

  return flow
}
