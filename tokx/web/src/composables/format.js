// 列定义与格式化：列顺序沿用命令行的出表顺序，数字口径与 tokx 报表一致。

// 三个来源的显示名与标记，标题栏的勾选框与表里的来源列共用。
export const SOURCE_LIST = [
  { key: 'claude', name: 'Claude Code', short: 'Claude', mark: 'C' },
  { key: 'opencode', name: 'opencode', short: 'oc', mark: 'O' },
  { key: 'dsh', name: 'DeepSeek Harness', short: 'Harness', mark: 'D' },
]

export const nf = new Intl.NumberFormat('zh-CN')
export const cf = new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const fmtNum = (value) => nf.format(Math.round(Number(value) || 0))
export const fmtMoney = (value) => (value == null ? '--' : cf.format(Number(value) || 0))

export function fmtTokens(value) {
  const n = Number(value) || 0
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return fmtNum(n)
}

const MONEY = { money: true }
const COUNT = { num: true }

export const HEAD = {
  source: { key: 'source', label: '来源', width: 9 },
  origin: { key: 'origin', label: '出处', width: 5 },
  date: { key: 'date', label: '日期', width: 10 },
  slot: { key: 'slot', label: '小时', width: 6 },
  label: { key: 'label', label: '时段', width: 8 },
  session: { key: 'session', label: '会话', width: 12, mono: true },
  project: { key: 'project', label: '项目', width: 12 },
  start: { key: 'start', label: '开始', width: 11 },
  model: { key: 'model', label: '模型', width: 20 },
  api: { key: 'api', label: 'API 地址', width: 15 },
  requests: { key: 'requests', label: '请求', ...COUNT },
  input: { key: 'input', label: '输入', ...COUNT },
  cache_read: { key: 'cache_read', label: '缓存读', ...COUNT },
  output: { key: 'output', label: '输出', ...COUNT },
  total_tokens: { key: 'total_tokens', label: '总 token', ...COUNT },
  cost_peak: { key: 'cost_peak', label: '高峰费用', ...MONEY },
  cost_off: { key: 'cost_off', label: '空闲费用', ...MONEY },
  cost: { key: 'cost', label: '合计', ...MONEY, strong: true },
}

const TOTALS = {
  requests: { key: 'requests', label: '', ...COUNT },
  input: { key: 'input', label: '', ...COUNT },
  cache_read: { key: 'cache_read', label: '', ...COUNT },
  output: { key: 'output', label: '', ...COUNT },
  total_tokens: { key: 'total_tokens', label: '', ...COUNT },
  cost_peak: { key: 'cost_peak', label: '', ...MONEY },
  cost_off: { key: 'cost_off', label: '', ...MONEY },
  cost: { key: 'cost', label: '合计', ...MONEY },
}

const TAIL = ['requests', 'input', 'cache_read', 'output', 'total_tokens', 'cost_peak', 'cost_off', 'cost']

export const COLUMNS = {
  daily: ['source', 'origin', 'date', 'model', 'api', ...TAIL].map((key) => HEAD[key]),
  session: ['source', 'origin', 'session', 'project', 'start', 'model', 'api', ...TAIL].map((key) => HEAD[key]),
  hour: ['slot', 'label', 'model', 'api', ...TAIL].map((key) => HEAD[key]),
  // 合计行与命令行一致：非数字列留空，"合计"两字放在最后一格（合计费用）上，数字列逐列对齐。
  totalsFor(command) {
    const front = command === 'session' ? 7 : 5
    // 第一格只是占位，让数字列落在表头对应的位置上。
    return ['', ...Array(front - 1).fill(''), ...TAIL].map((key, index) =>
      key === '' ? { key: `blank${index}`, label: '' } : TOTALS[key],
    )
  },
}

export function cellValue(column, row, blankMissing = false) {
  // 合计行里没有的格子留空，明细行里缺的格子写成 -。
  if (blankMissing && (row[column.key] === '' || row[column.key] == null)) return ''
  const value = row[column.key]
  if (column.key === 'source') {
    const found = SOURCE_LIST.find((item) => item.key === value)
    return found ? found.short : value || '-'
  }
  if (column.key === 'origin') return value === 'cache' ? '缓存' : '现扫'
  if (column.money) return fmtMoney(value)
  if (column.num) return fmtNum(value)
  if (column.key === 'label') return value === '高峰窗口' ? '高峰' : value
  return value === '' || value == null ? '-' : String(value)
}
