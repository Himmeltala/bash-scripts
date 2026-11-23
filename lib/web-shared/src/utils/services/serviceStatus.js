/*
 * @Author: Himmeltala
 * @Date: 2026-11-23 23:09:19
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-23 23:09:19
 * @FilePath: \lib\web-shared\src\utils\services\serviceStatus.js
 * @Description: 服务运行状态的公共判断：运行状态集合、图标、颜色与文案。
*/

// 服务运行状态的公共判断：idex 的 Node 引擎与 mvnx 的服务清单共用，不属于通用格式化。

import { baseName } from '../commons/format.js'

// 启动中与运行中都算在跑。
export const LIVE_STATUSES = ['starting', 'ready']

// 服务状态对应的图标，idex 的 Node 与 JVM 引擎的行用同一套。
export function serviceIcon(status) {
  if (status === 'ready') return 'mdi-play-circle'
  if (status === 'starting') return 'mdi-progress-clock'
  if (status === 'failed') return 'mdi-alert-circle'
  if (status === 'exited') return 'mdi-check-circle'
  return 'mdi-stop-circle'
}

export function runningCount(ws, live = LIVE_STATUSES) {
  return (ws.services || []).filter((s) => s.run && live.includes(s.run.status)).length
}

// 头部「x 个在跑」点开后的清单：只留有进程的工作区，名字优先用别名。
export function runningByWorkspace(workspaces, live = LIVE_STATUSES) {
  const out = []
  for (const ws of workspaces || []) {
    const count = runningCount(ws, live)
    if (!count) continue
    out.push({ id: ws.id, name: ws.alias || baseName(ws.root), count })
  }
  return out
}
