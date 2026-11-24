/*
 * @Author: Himmeltala
 * @Date: 2026-11-23 21:40:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 21:41:59
 * @FilePath: \idex\web\src\features\engines\lib\engineEnable.js
 * @Description: 引擎页签共用的启用流程：先让 idex 探测能力，再让引擎登记并扫描，结果由状态推送补上。
 */
import { ref } from 'vue'
import { createScanWait } from './scanWait.js'

function read(value) {
  return typeof value === 'function' ? value() : value
}

export function createEngineEnable({
  toolsApi,
  engineApi,
  wsId,
  isRegistered,
  reload,
  timeoutText,
  waitLimit,
  // 扫描在后台跑，失败原因只有引擎自己知道；给了这个接口就在等待期间轮询。
  rescanStatus,
  pollInterval = 1000,
}) {
  const enabling = ref(false)
  const waiting = ref(false)
  const enableError = ref('')
  let token = 0
  let alive = true
  let pollTimer = null

  // 扫描结果靠状态推送回来；等太久就把按钮放开，别一直卡在「扫描中」。
  const wait = createScanWait({
    limit: waitLimit,
    onTimeout: () => {
      stopPoll()
      waiting.value = false
      enableError.value = timeoutText
    },
  })

  function stopPoll() {
    if (pollTimer !== null) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  function startPoll() {
    stopPoll()
    if (typeof rescanStatus !== 'function' || typeof setInterval !== 'function') return
    pollTimer = setInterval(async () => {
      if (!alive || !waiting.value) {
        stopPoll()
        return
      }
      const id = read(wsId)
      try {
        const data = await rescanStatus(id)
        if (!alive || !waiting.value || read(wsId) !== id) return
        if (data && data.error) {
          stopWait()
          enableError.value = data.error
        }
      } catch (err) {
        // 轮询失败不当作扫描失败；等待时限到了仍然会放开。
      }
    }, pollInterval)
    if (pollTimer && typeof pollTimer.unref === 'function') pollTimer.unref()
  }

  function stopWait(clearError = false) {
    stopPoll()
    wait.stop()
    waiting.value = false
    if (clearError) enableError.value = ''
  }

  // 「启用并扫描」：只调 tools 的探测不会往引擎状态里写工作区行，所以两条都要走；
  // 串行避免引擎刚重扫又撞 409。换工作区或卸载时 token 变化，回来的请求不再改状态。
  async function enable() {
    const mine = ++token
    const id = read(wsId)
    enabling.value = true
    stopWait(true)
    try {
      await toolsApi.rescan(id)
      // 探测回来前换了工作区就停手，别再对旧工作区发一次引擎重扫。
      if (!alive || mine !== token || read(wsId) !== id) return
      await engineApi.rescan(id)
      if (!alive || mine !== token || read(wsId) !== id) return
      if (!read(isRegistered)) {
        waiting.value = true
        wait.start()
        startPoll()
      }
      await reload()
    } catch (err) {
      if (!alive || mine !== token || read(wsId) !== id) return
      stopWait()
      enableError.value = err.message
    } finally {
      if (alive && mine === token && read(wsId) === id) enabling.value = false
    }
  }

  function retry() {
    stopWait(true)
    reload()
  }

  function reset() {
    token += 1
    stopWait(true)
    enabling.value = false
  }

  function dispose() {
    alive = false
    token += 1
    stopWait()
  }

  return { enabling, waiting, enableError, enable, retry, stopWait, reset, dispose }
}
