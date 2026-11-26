/*
 * @Author: Himmeltala
 * @Date: 2026-11-25 00:00:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-26 11:20:00
 * @FilePath: \idex\web\src\stores\dock.js
 * @Description: 全局底部面板的展开状态、高度与当前视图；只记在本机。
 */
import { defineStore } from 'pinia'
import { useLocalStorage } from '@vueuse/core'

export const DEFAULT_DOCK_HEIGHT = 280
export const DEFAULT_DOCK_WIDTH = 520

export const useDockStore = defineStore('dock', () => {
  const open = useLocalStorage('idex.terminal-open', false)
  const height = useLocalStorage('idex.terminal-height', DEFAULT_DOCK_HEIGHT)
  const width = useLocalStorage('idex.terminal-width', DEFAULT_DOCK_WIDTH)
  const view = useLocalStorage('idex.dock-view', 'terminal')
  // 每个视图各记各的呼出方向；没记过的用视图登记表里的默认值。
  const placements = useLocalStorage('idex.dock-placement', {})

  function placementOf(id, fallback = 'bottom') {
    return placements.value?.[id] || fallback
  }

  function setPlacement(id, placement) {
    if (!id) return
    placements.value = { ...placements.value, [id]: placement }
  }

  function show(id = 'terminal') {
    view.value = id
    open.value = true
  }

  function toggle(id = 'terminal') {
    if (open.value && view.value === id) {
      open.value = false
      return
    }
    show(id)
  }

  return { open, height, width, view, placements, placementOf, setPlacement, show, toggle }
})
