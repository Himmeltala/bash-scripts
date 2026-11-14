// 页面上反复用到的小格式化：共享的纯函数走 /format，这里只留业务常量。

import { formatAgo } from '@bash-scripts/web-shared/format'

export const ago = formatAgo

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

// 打包与安装跑完就结束，运行记录留在列表里，点开日志能看到结果。
export const LIVE = ['starting', 'ready']

export function runningCount(ws) {
  return (ws.services || []).filter((s) => s.run && LIVE.includes(s.run.status)).length
}

export const TYPE_TEXT = {
  run: '启动',
  war: '启动',
  package: '打包',
  install: '安装',
}

export const MODE_ITEMS = [
  { value: 'auto', title: '自动判编译', hint: '源码没动过就跳过编译，与命令行一致' },
  { value: 'compile', title: '强制编译', hint: '总是先编译再跑' },
  { value: 'no-compile', title: '不编译', hint: '直接用已编译的 class 跑，没编过会拒绝' },
  { value: 'rebuild', title: '重新编译', hint: '先 clean 再跑' },
]

// 模块清单是前端用 mvn 现成的模块：pom 路径相对工作区根，逐级去掉 ./ 之后与 mvn -pl 写法一致。
export function moduleOf(rel) {
  return String(rel || '').replace(/^(\.\/)+/, '')
}

export function tailPath(full) {
  const parts = String(full || '').split('/').filter(Boolean)
  return parts.slice(-3).join('/') || full
}
