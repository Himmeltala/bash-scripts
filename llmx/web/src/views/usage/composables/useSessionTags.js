// 会话标记：收藏、忽略与备注，只存在浏览器里。

import { useLocalStorage } from '@vueuse/core'

export const sessionTags = useLocalStorage('llmx.session-tags', {}, { writeDefaults: false })

export function sessionKey(row) {
  return row ? `${row.source}/${row.session}` : ''
}

export function tagOf(row) {
  const key = sessionKey(row)
  return (key && sessionTags.value[key]) || {}
}

export function setTag(row, patch) {
  const key = sessionKey(row)
  if (!key) return
  const current = sessionTags.value[key] || {}
  const next = { ...current, ...patch }
  if (!next.star && !next.ignored && !next.note) delete sessionTags.value[key]
  else sessionTags.value = { ...sessionTags.value, [key]: next }
}
