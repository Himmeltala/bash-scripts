// 预算存在服务端，所有设备共用；花费从日报接口按日聚合，超支与接近上限时给出提醒。

import { computed, ref } from 'vue'
import { formatDate, startOfWeek } from '@bash-scripts/web-shared/format'
import { call } from '../../../composables/useApi'
import { fmtMoney } from './format'

const EMPTY = { daily: 0, weekly: 0, monthly: 0, items: [] }
const KIND_NAMES = { model: '模型', project: '项目', api: 'API' }
const PERIOD_NAMES = { daily: '每日', weekly: '每周', monthly: '每月' }

export const budgets = ref({ ...EMPTY })
export const spend = ref({ daily: 0, weekly: 0, monthly: 0, items: {}, loaded: false })

let loading = null
let loaded = false
let spending = false

function hasLimit(value) {
  return Boolean(
    Number(value?.daily) ||
      Number(value?.weekly) ||
      Number(value?.monthly) ||
      (value?.items || []).length
  )
}

// 多处同时进入页面时只读一次，后来的等同一个结果；读成功后不再重复请求。
export function loadBudgets() {
  if (loaded) return Promise.resolve(budgets.value)
  if (!loading) {
    loading = (async () => {
      try {
        budgets.value = await call('GET', '/budget')
        loaded = true
        await refreshSpend()
        return budgets.value
      } finally {
        loading = null
      }
    })()
  }
  return loading
}

export async function saveBudgets(value) {
  const saved = await call('POST', '/budget', value)
  budgets.value = saved
  await refreshSpend()
  return saved
}

// 本月日报一次取回，总额与分项都从这张表聚合。
export async function refreshSpend(force = false) {
  if (spending) return
  if (!force && !hasLimit(budgets.value)) {
    spend.value = { daily: 0, weekly: 0, monthly: 0, items: {}, loaded: false }
    return
  }
  spending = true
  try {
    const today = new Date()
    const weekStart = formatDate(startOfWeek(today))
    const monthStart = formatDate(new Date(today.getFullYear(), today.getMonth(), 1))
    const params = new URLSearchParams({
      command: 'daily',
      since: monthStart,
      until: formatDate(today),
    })
    const body = await call('GET', `/usage?${params.toString()}`)
    const daily = new Map()
    const items = { model: {}, project: {}, api: {} }
    for (const row of body.rows || []) {
      const date = String(row.date || '')
      const cost = Number(row.cost) || 0
      daily.set(date, (daily.get(date) || 0) + cost)
      for (const kind of Object.keys(items)) {
        const name = String(row[kind] || (kind === 'project' ? '未记录' : ''))
        if (name) items[kind][name] = (items[kind][name] || 0) + cost
      }
    }
    const todayText = formatDate(today)
    let day = 0
    let week = 0
    let month = 0
    for (const [date, cost] of daily) {
      month += cost
      if (date === todayText) day += cost
      if (date >= weekStart) week += cost
    }
    spend.value = { daily: day, weekly: week, monthly: month, items, loaded: true }
  } catch (err) {
    // 取不到就保持上一次的数，提示下一次再补。
  } finally {
    spending = false
  }
}

function ratioText(ratio) {
  return `${(ratio * 100).toFixed(1)}%`
}

// 花掉八成算接近上限，超了算超支；0 表示不设上限。
export function toneOf(spent, limit) {
  if (!limit) return ''
  const ratio = spent / limit
  if (ratio >= 1) return 'bad'
  if (ratio >= 0.8) return 'warn'
  return ''
}

function alertOf(label, used, limit) {
  const level = toneOf(used, limit)
  if (!level) return null
  const detail = level === 'bad' ? '已超' : `已用 ${ratioText(used / limit)}`
  return { level, text: `${label}预算${detail}：¥${fmtMoney(used)} / ¥${fmtMoney(limit)}` }
}

// 超支或达到八成时给一条提醒；总额按日、周、月，分项只有月度上限。
export const alerts = computed(() => {
  const values = budgets.value || EMPTY
  const out = []
  for (const key of ['daily', 'weekly', 'monthly']) {
    const limit = Number(values[key]) || 0
    if (!limit) continue
    const alert = alertOf(PERIOD_NAMES[key], Number(spend.value[key]) || 0, limit)
    if (alert) out.push(alert)
  }
  for (const item of values.items || []) {
    const limit = Number(item.limit) || 0
    if (!limit) continue
    const used = Number(spend.value.items?.[item.kind]?.[item.name]) || 0
    const label = `${KIND_NAMES[item.kind] || item.kind} ${item.name} 的月度`
    const alert = alertOf(label, used, limit)
    if (alert) out.push(alert)
  }
  return out
})
