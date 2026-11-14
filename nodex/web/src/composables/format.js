// 页面上反复用到的小格式化：共享的纯函数走 /format，这里只留业务常量。

import { formatAgo, formatBytes } from '@bash-scripts/web-shared/format'

export { baseName } from '@bash-scripts/web-shared/format'
export const ago = formatAgo
export const sizeText = formatBytes

export const STATUS_TEXT = {
  starting: '启动中',
  ready: '运行中',
  exited: '已结束',
  failed: '失败',
  stopped: '已停止',
}

export const STATUS_COLOR = {
  starting: 'warning',
  ready: 'ready',
  exited: 'grey',
  failed: 'failed',
  stopped: 'grey',
}

// 构建与安装跑完就结束，运行记录留在列表里，点开日志能看到结果。
export const LIVE = ['starting', 'ready']

export function runningCount(ws) {
  return (ws.services || []).filter((s) => s.run && LIVE.includes(s.run.status)).length
}

export const TYPE_TEXT = {
  dev: '启动',
  build: '打包',
  install: '安装',
}

export function tailPath(full) {
  const parts = String(full || '').split('/').filter(Boolean)
  return parts.slice(-3).join('/') || full
}
