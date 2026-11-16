// 服务运行状态的公共判断：nodex 与 mvnx 的服务清单共用，不属于通用格式化。

// 启动中与运行中都算在跑。
export const LIVE_STATUSES = ['starting', 'ready']

export function runningCount(ws, live = LIVE_STATUSES) {
  return (ws.services || []).filter((s) => s.run && live.includes(s.run.status)).length
}
