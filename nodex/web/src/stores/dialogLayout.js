import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'

// 浮动弹窗的大小与位置按名字存在浏览器里，刷新后照旧；存储不可用时只在内存里。
export const useDialogLayoutStore = defineStore('dialogLayout', () => {
  const layouts = useLocalStorage('nodex.dialog-layouts', {}, { writeDefaults: false })

  function all() {
    return layouts.value && typeof layouts.value === 'object' ? layouts.value : {}
  }

  // 字段不完整就当没存过，免得拿脏数据摆窗口。
  function get(key) {
    if (!key) return null
    const one = all()[key]
    if (!one) return null
    const ok = ['x', 'y', 'w', 'h'].every((name) => Number.isFinite(one[name]))
    return ok ? { x: one.x, y: one.y, w: one.w, h: one.h } : null
  }

  function remember(key, layout) {
    if (!key) return
    layouts.value = { ...all(), [key]: layout }
  }

  return { layouts, get, remember }
})
