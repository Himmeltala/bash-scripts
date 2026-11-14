// 页面上反复用到的纯格式化函数，不依赖 Vue 与任何 UI 库。

// 路径的最后一段；空串原样返回。
export function baseName(full) {
  const text = String(full || '')
  const parts = text.split('/').filter(Boolean)
  return parts.length ? parts[parts.length - 1] : text
}

// 去掉最后一段后的目录部分。
export function dirName(full) {
  const parts = String(full || '').split('/')
  parts.pop()
  return parts.join('/')
}

// 仓库里的相对路径去掉开头的斜杠。
export function shortPath(repoPath) {
  return String(repoPath || '').replace(/^\/+/, '')
}

// 列表窄，长路径从中间省略：开头看得到模块，结尾看得到文件名。
export function shortenPath(text, max = 42) {
  const s = String(text || '')
  if (s.length <= max) return s
  const keep = max - 1
  const head = Math.ceil(keep / 3)
  const tail = keep - head
  return s.slice(0, head) + '…' + s.slice(-tail)
}

// 提交说明只取第一行非空内容。
export function firstLine(text) {
  const lines = String(text || '').split('\n')
  return lines.find((line) => line.trim()) || '（没有写提交说明）'
}

// SVN 给 UTC（带 Z），Git 给带偏移的时间；统一按浏览器时区显示到分钟。
export function formatDateTime(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return String(iso).slice(0, 16)
  const pad = (value) => String(value).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

// 秒级时间戳换成「几分钟前」；now 是毫秒，默认取当前时间。
export function formatAgo(sec, now = Date.now()) {
  const n = Number(sec)
  if (!n) return ''
  const diff = Math.max(0, Math.floor(now / 1000) - n)
  if (diff < 60) return `${diff} 秒前`
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  return `${Math.floor(diff / 86400)} 天前`
}

// 文件大小：默认不到 1 KB 按字节写，往上一位、两位小数取 KB、MB。
// units 与 precision 一一对应，需要别的单位或精度时由调用方传。
export function formatBytes(
  bytes,
  { units = ['B', 'KB', 'MB'], precision = [0, 1, 2], base = 1024 } = {},
) {
  const n = Number(bytes) || 0
  let index = 0
  while (index < units.length - 1 && n >= base ** (index + 1)) index += 1
  return `${(n / base ** index).toFixed(precision[index] ?? 0)} ${units[index]}`
}

const NUMBER_FORMAT = new Intl.NumberFormat('zh-CN')
const MONEY_FORMAT = new Intl.NumberFormat('zh-CN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatNumber(value) {
  return NUMBER_FORMAT.format(Math.round(Number(value) || 0))
}

export function formatMoney(value) {
  return value == null ? '--' : MONEY_FORMAT.format(Number(value) || 0)
}

// 大数用 K/M/B 缩写，口径与 tokx 报表一致。
export function formatCompact(value) {
  const n = Number(value) || 0
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return formatNumber(n)
}
