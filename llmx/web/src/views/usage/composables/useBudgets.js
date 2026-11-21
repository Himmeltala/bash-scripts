// 预算存在服务端，所有设备共用；花费从日报接口按日聚合，超支与接近上限时给出提醒。

import { computed, ref } from 'vue'
import { formatDate, startOfWeek } from '@bash-scripts/web-shared/format'
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

async function request(method = 'GET', data) {
  const response = await fetch('/api/budget', {
    method,
    headers: data ? { 'Content-Type': 'application/json' } : undefined,
    body: data ? JSON.stringify(data) : undefined,
    cache: 'no-store',
  })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || `请求失败（${response.status}）`)
  return body
}

// 多处同时进入页面时只读一次，后来的等同一个结果；读成功后不再重复请求。
export function loadBudgets() {
  if (loaded) return Promise.resolve(budgets.value)
  if (!loading) {
    loading = (async () => {
      try {
        budgets.value = await request()
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
  const saved = await request('POST', value)
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
    const response = await fetch(`/api/usage?${params.toString()}`, { cache: 'no-store' })
    const body = await response.json()
    if (!response.ok) return
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

// 超支或达到八成时给一条提醒；总额按日、周、月，分项只有月度上限。
export const alerts = computed(() => {
  const values = budgets.value || EMPTY
  const out = []
  for (const key of ['daily', 'weekly', 'monthly']) {
    const limit = Number(values[key]) || 0
    if (!limit) continue
    const used = Number(spend.value[key]) || 0
    const ratio = used / limit
    if (ratio >= 1) {
      out.push({ level: 'bad', text: `${PERIOD_NAMES[key]}预算已超：¥${fmtMoney(used)} / ¥${fmtMoney(limit)}` })
    } else if (ratio >= 0.8) {
      out.push({
        level: 'warn',
        text: `${PERIOD_NAMES[key]}预算已用 ${ratioText(ratio)}：¥${fmtMoney(used)} / ¥${fmtMoney(limit)}`,
      })
    }
  }
  for (const item of values.items || []) {
    const limit = Number(item.limit) || 0
    if (!limit) continue
    const used = Number(spend.value.items?.[item.kind]?.[item.name]) || 0
    const ratio = used / limit
    const label = `${KIND_NAMES[item.kind] || item.kind} ${item.name} 的月度`
    if (ratio >= 1) {
      out.push({ level: 'bad', text: `${label}预算已超：¥${fmtMoney(used)} / ¥${fmtMoney(limit)}` })
    } else if (ratio >= 0.8) {
      out.push({
        level: 'warn',
        text: `${label}预算已用 ${ratioText(ratio)}：¥${fmtMoney(used)} / ¥${fmtMoney(limit)}`,
      })
    }
  }
  return out
})
