// 出网记录的展示格式：时长与目标地址。

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

const KIND_LABELS = {
  http: 'HTTP',
  tls: 'TLS',
  dns: 'DNS',
  text: '文本',
  binary: '二进制',
}

export function kindLabel(kind) {
  return KIND_LABELS[kind] || '—'
}

export function formatTarget(row) {
  const host = String(row?.dst_ip || '')
  const port = row?.dst_port
  if (!host) return '—'
  return port ? host + ':' + port : host
}
