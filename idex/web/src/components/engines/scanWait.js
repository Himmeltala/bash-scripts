/*
 * @Author: Himmeltala
 * @Date: 2026-11-23 20:30:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-23 23:09:19
 * @FilePath: \idex\web\src\components\engines\scanWait.js
 * @Description: 引擎扫描的等待时限：结果靠状态推送回来，等太久或换了工作区就放开按钮让用户重试。
 */

// 引擎自己的扫描最长按两分钟算，留几秒余量再判超时。
export const SCAN_WAIT_MS = 125000

export function createScanWait({ onTimeout, limit = SCAN_WAIT_MS } = {}) {
  let timer = null
  let token = 0

  function stop() {
    token += 1
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  function start() {
    stop()
    const mine = token
    timer = setTimeout(() => {
      if (mine !== token) return
      timer = null
      if (onTimeout) onTimeout()
    }, limit)
    // Node 里跑测试时别把进程拖住；浏览器里返回的是数字，没有 unref。
    if (timer && typeof timer.unref === 'function') timer.unref()
  }

  return { start, stop }
}
