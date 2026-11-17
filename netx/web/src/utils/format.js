// 出网记录的展示格式：时间、时长与目标地址。

export function formatTime(ts) {
  const sec = Number(ts)
  if (!sec) return '—'
  return new Date(sec * 1000).toLocaleString('zh-CN', { hour12: false })
}

export function formatDuration(sec) {
  const value = Math.max(0, Math.round(Number(sec) || 0))
  if (value < 60) return value + 's'
  if (value < 3600) {
    return Math.floor(value / 60) + 'm' + String(value % 60).padStart(2, '0') + 's'
  }
  return (
    Math.floor(value / 3600) +
    'h' +
    String(Math.floor((value % 3600) / 60)).padStart(2, '0') +
    'm'
  )
}

export function formatTarget(row) {
  const host = String(row?.dst_ip || '')
  const port = row?.dst_port
  if (!host) return '—'
  return port ? host + ':' + port : host
}
