/*
 * @Author: Himmeltala
 * @Date: 2026-11-25 00:00:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-25 00:00:00
 * @FilePath: \idex\web\src\stores\dock.js
 * @Description: 全局底部面板的展开状态、高度与当前视图；只记在本机。
 */
import { defineStore } from 'pinia'
import { useLocalStorage } from '@vueuse/core'

export const useDockStore = defineStore('dock', () => {
  const open = useLocalStorage('idex.terminal-open', false)
  const height = useLocalStorage('idex.terminal-height', 280)
  const view = useLocalStorage('idex.dock-view', 'terminal')

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

  return { open, height, view, show, toggle }
})
