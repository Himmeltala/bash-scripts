// 上一段等长范围的数据：当前范围一换就重取，只用来算对比，不参与 SSE 推送。

import { ref, watch } from 'vue'
import { formatDate } from '@bash-scripts/web-shared/format'
import { data } from './useUsage'
import { query } from './useView'

export const previous = ref(null)

function previousParams(payload) {
  if (!payload?.since || !payload?.until) return null
  const since = new Date(`${payload.since}T00:00:00`)
  const until = new Date(`${payload.until}T00:00:00`)
  const span = Math.round((until - since) / 86400000) + 1
  const prevUntil = new Date(since)
  prevUntil.setDate(prevUntil.getDate() - 1)
  const prevSince = new Date(prevUntil)
  prevSince.setDate(prevSince.getDate() - (span - 1))
  const params = query()
  params.set('command', payload.command)
  params.set('since', formatDate(prevSince))
  params.set('until', formatDate(prevUntil))
  params.delete('days')
  params.delete('all')
  return params
}

async function refresh() {
  const params = previousParams(data.value)
  if (!params) {
    previous.value = null
    return
  }
  try {
    const response = await fetch(`/api/usage?${params.toString()}`, { cache: 'no-store' })
    const body = await response.json()
    previous.value = response.ok ? body : null
  } catch (err) {
    previous.value = null
  }
}

let timer = 0
watch(
  () => [
    data.value?.command,
    data.value?.since,
    data.value?.until,
    query().toString(),
  ],
  () => {
    clearTimeout(timer)
    timer = setTimeout(refresh, 300)
  },
  { immediate: true }
)
