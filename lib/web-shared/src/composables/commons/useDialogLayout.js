// 浮动弹窗的大小与位置按名字存在浏览器里，刷新后照旧；存储不可用时只在内存里。

export function useDialogLayout(storageKey) {
  function all() {
    try {
      const data = JSON.parse(window.localStorage.getItem(storageKey) || '{}')
      return data && typeof data === 'object' ? data : {}
    } catch (err) {
      return {}
    }
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
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ ...all(), [key]: layout }))
    } catch (err) {
      // 隐私模式下写不进去，位置只在这次会话里生效。
    }
  }

  return { get, remember }
}
