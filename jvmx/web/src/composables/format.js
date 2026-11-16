// 页面上反复用到的小格式化：共享的纯函数走 /format，这里只留业务常量。

import { LIVE_STATUSES } from '@bash-scripts/web-shared'
import { formatAgo } from '@bash-scripts/web-shared/format'

export { runningCount } from '@bash-scripts/web-shared'
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
export const LIVE = LIVE_STATUSES

export const TYPE_TEXT = {
  run: '启动',
  war: '启动',
  package: '打包',
  install: '安装',
  build: '构建',
}

// 工作区类型只影响页签、启动参数与 JDK 下拉，不影响服务行本身。
export const KIND_TEXT = {
  mvn: 'Maven',
  gradle: 'Gradle',
}

export const MODE_ITEMS = [
  { value: 'auto', title: '自动判编译', hint: '源码没动过就跳过编译，与命令行一致' },
  { value: 'compile', title: '强制编译', hint: '总是先编译再跑' },
  { value: 'no-compile', title: '不编译', hint: '直接用已编译的 class 跑，没编过会拒绝' },
  { value: 'rebuild', title: '重新编译', hint: '先 clean 再跑' },
]

// Gradle 没有 Maven 的编译判定，只提供直接跑与先 clean 两档。
export const GRADLE_MODE_ITEMS = [
  { value: 'auto', title: '直接执行', hint: '按 Gradle 自己的增量规则跑' },
  { value: 'rebuild', title: '先 clean', hint: '先清理再执行，改动大时用' },
]

// 模块清单是前端用 mvn 现成的模块：pom 路径相对工作区根，逐级去掉 ./ 之后与 mvn -pl 写法一致。
export function moduleOf(rel) {
  return String(rel || '').replace(/^(\.\/)+/, '')
}

export function tailPath(full) {
  const parts = String(full || '').split('/').filter(Boolean)
  return parts.slice(-3).join('/') || full
}
