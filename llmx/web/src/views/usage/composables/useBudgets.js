// 预算与本期花费：预算存在浏览器里，花费从日报接口按日聚合。

import { ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { formatDate, startOfWeek } from '@bash-scripts/web-shared/format'

export const budgets = useLocalStorage(
  'llmx.budgets',
  { daily: 0, weekly: 0, monthly: 0, items: [] },
  { mergeDefaults: true, writeDefaults: false }
)

export const spend = ref({ daily: 0, weekly: 0, monthly: 0 })
let loading = false

export async function refreshSpend() {
  if (loading) return
  const values = budgets.value || {}
  if (!Number(values.daily) && !Number(values.weekly) && !Number(values.monthly)) {
    spend.value = { daily: 0, weekly: 0, monthly: 0 }
    return
  }
  loading = true
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
    for (const row of body.rows || []) {
      const date = String(row.date || '')
      daily.set(date, (daily.get(date) || 0) + (Number(row.cost) || 0))
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
    spend.value = { daily: day, weekly: week, monthly: month }
  } catch (err) {
    // 取不到就保持上一次的数，提示下一次再补。
  } finally {
    loading = false
  }
}
