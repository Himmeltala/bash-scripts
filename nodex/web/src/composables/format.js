// 页面上反复用到的小格式化。

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

export function ago(sec) {
  const n = Number(sec)
  if (!n) return ''
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - n)
  if (diff < 60) return `${diff} 秒前`
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  return `${Math.floor(diff / 86400)} 天前`
}

// 路径的最后一段，压缩包名默认就用工作区目录名。
export function baseName(full) {
  const parts = String(full || '').split('/').filter(Boolean)
  return parts.length ? parts[parts.length - 1] : String(full || '')
}

// 文件大小：不到 1 KB 按字节写，往上两位小数取 KB、MB。
export function sizeText(bytes) {
  const n = Number(bytes) || 0
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

export function tailPath(full) {
  const parts = String(full || '').split('/').filter(Boolean)
  return parts.slice(-3).join('/') || full
}
