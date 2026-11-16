// 面板里的分隔条：按住拖动改一侧尺寸，双击还原，宽度可以记在本地下次接着用。
// area 是量尺寸的容器；unit 为 px 时另一侧至少留 rightMin，为 pct 时按百分比算。

import { onBeforeUnmount, ref, watch } from 'vue'

const BODY_CLASS = 'web-shared-resizing'

export function useSplitPane({
  area,
  initial,
  min = 0,
  max = 100,
  rightMin = 0,
  axis = 'x',
  unit = 'px',
  persist = '',
}) {
  const size = ref(stored())
  const resizing = ref(false)
  let startPos = 0
  let startSize = 0

  function stored() {
    if (!persist) return initial
    try {
      const value = Number(window.localStorage.getItem(persist))
      return Number.isFinite(value) && value > 0 ? value : initial
    } catch (err) {
      return initial
    }
  }

  function clamp(value) {
    let upper = max
    if (unit === 'px' && area.value) {
      const total = axis === 'x' ? area.value.clientWidth : area.value.clientHeight
      if (total) upper = Math.max(min, total - rightMin)
    }
    return Math.min(Math.max(value, min), upper)
  }

  function onMove(event) {
    const box = area.value
    if (!box) return
    const total = axis === 'x' ? box.clientWidth : box.clientHeight
    if (!total) return
    const delta = (axis === 'x' ? event.clientX : event.clientY) - startPos
    size.value = clamp(startSize + (unit === 'pct' ? (delta / total) * 100 : delta))
  }

  function stop() {
    if (!resizing.value) return
    resizing.value = false
    window.removeEventListener('pointermove', onMove)
    document.body.classList.remove(BODY_CLASS)
  }

  function start(event) {
    if (event.button !== 0 || !area.value) return
    resizing.value = true
    startPos = axis === 'x' ? event.clientX : event.clientY
    startSize = size.value
    event.preventDefault()
    // 拖出容器时别把页面文字一起选中。
    document.body.classList.add(BODY_CLASS)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', stop, { once: true })
  }

  function reset() {
    size.value = initial
  }

  watch(size, (value) => {
    if (!persist) return
    try {
      window.localStorage.setItem(persist, String(value))
    } catch (err) {
      // 存不进去就算了，不影响这次拖动。
    }
  })

  onBeforeUnmount(stop)

  return { size, resizing, start, stop, reset }
}
