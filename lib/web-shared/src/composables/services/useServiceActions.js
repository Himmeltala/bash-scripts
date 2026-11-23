/*
 * @Author: Himmeltala
 * @Date: 2026-11-23 23:09:19
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-23 23:09:19
 * @FilePath: \lib\web-shared\src\composables\services\useServiceActions.js
 * @Description: 服务行的启动、停止与设置弹窗，接管按钮忙碌态与日志弹窗。
*/

// 服务行的启动、停止与设置弹窗：idex 的 Node 与 JVM 引擎操作流程一致，差异只在启动参数。
// 调用方给 emit 回调与启动载荷，这里管按钮的短暂忙碌状态、日志弹窗与关闭时断开日志流。

import { reactive, ref, watch } from 'vue'
import { useRunLog } from './useRunLog.js'

export function useServiceActions({
  ws,
  api,
  statusText = {},
  startPayload = (row) => ({ svc: row.svc.id }),
  onStart,
  onStop,
}) {
  const starting = ref({})
  const stopping = ref({})
  const settings = reactive({ on: false, svc: null })

  const {
    text: logText,
    more: logMore,
    status: logStatus,
    open: openLogRun,
    close: closeLogRun,
    loadMore: loadMoreLog,
  } = useRunLog({ api, ws, statusText })

  function start(row) {
    starting.value[row.svc.id] = true
    onStart(startPayload(row))
    setTimeout(() => {
      starting.value[row.svc.id] = false
    }, 1500)
  }

  function stop(row) {
    stopping.value[row.svc.id] = true
    onStop(row.run.id)
    setTimeout(() => {
      stopping.value[row.svc.id] = false
    }, 3000)
  }

  function openSettings(row) {
    settings.svc = row.svc
    settings.on = true
    openLogRun(row.run, row.svc.id)
  }

  function openLog(row) {
    if (!row.run) return
    settings.svc = row.svc || null
    settings.on = true
    openLogRun(row.run, (row.svc || {}).id || '')
  }

  // 弹窗关掉就断开日志流。
  watch(
    () => settings.on,
    (on) => {
      if (!on) closeLogRun()
    },
  )

  return {
    starting,
    stopping,
    settings,
    logText,
    logMore,
    logStatus,
    loadMoreLog,
    start,
    stop,
    openSettings,
    openLog,
  }
}
