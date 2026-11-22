// 顶栏警示：预算告警在前，无价格模型垫后。

import { computed } from 'vue'
import { alerts, unpricedModels } from './useBudgets.js'

export function unpricedText(models) {
  return `这些模型没有价格，只算 token 不算钱：${models.join('、')}`
}

export function warningRows(alerts, unpricedModels) {
  const list = alerts || []
  const rows = [
    ...list.filter((item) => item.level === 'bad'),
    ...list.filter((item) => item.level !== 'bad'),
  ].map((item) => ({ level: item.level, text: item.text }))
  const models = unpricedModels || []
  if (models.length) {
    rows.push({ level: 'warn', kind: 'unpriced', text: unpricedText(models) })
  }
  return rows
}

export function warningTone(rows) {
  if (!rows.length) return ''
  return rows.some((row) => row.level === 'bad') ? 'error' : 'warning'
}

export function useWarnings() {
  const rows = computed(() => warningRows(alerts.value, unpricedModels.value))
  const tone = computed(() => warningTone(rows.value))
  return { rows, tone }
}
