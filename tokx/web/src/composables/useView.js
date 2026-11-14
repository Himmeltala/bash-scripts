// 视图状态：报表、范围、来源与排序同步到地址栏，刷新页面或分享链接都能还原。

import { computed, reactive, watch } from 'vue'
import { SOURCE_LIST } from './format'

export const SOURCES = SOURCE_LIST

export const COMMANDS = [
  { key: 'daily', name: '按天汇总' },
  { key: 'session', name: '按会话汇总' },
  { key: 'hour', name: '按小时汇总' },
]

export const RANGES = [
  { key: '1', name: '今天' },
  { key: '7', name: '近 7 天' },
  { key: '14', name: '近 14 天' },
  { key: '30', name: '近 30 天' },
  { key: 'all', name: '全部历史' },
  { key: 'custom', name: '自定义' },
]

function fromUrl() {
  const params = new URLSearchParams(location.search)
  const valid = (list, value, fallback) => (list.some((item) => item.key === value) ? value : fallback)
  const picked = (params.get('source') || '').split(',').filter(Boolean)
  return {
    command: valid(COMMANDS, params.get('command'), 'daily'),
    range: valid(RANGES, params.get('range') || params.get('days'), '14'),
    since: params.get('since') || '',
    until: params.get('until') || '',
    sources: SOURCE_LIST.filter((item) => (picked.length ? picked.includes(item.key) : true)).map((item) => item.key),
  }
}

export const view = reactive(fromUrl())
view.sort = { key: '', desc: true }

export const rangeText = computed(() => {
  if (view.range === 'custom') return `${view.since || '…'} 至 ${view.until || '…'}`
  if (view.range === 'all') return '全部历史'
  return RANGES.find((item) => item.key === view.range)?.name || ''
})

// 请求参数：没选满来源时只带选中的那几个，命令行的 -s 语义。
export function query(extra = {}) {
  const params = new URLSearchParams(extra)
  params.set('command', view.command)
  if (view.range === 'custom') {
    if (view.since) params.set('since', view.since)
    if (view.until) params.set('until', view.until)
  } else if (view.range === 'all') {
    params.set('all', '1')
  } else {
    params.set('days', view.range)
  }
  if (view.sources.length < SOURCES.length) params.set('source', view.sources.join(','))
  return params
}

export function href() {
  const params = query()
  params.set('range', view.range)
  params.delete('command')
  if (view.command !== 'daily') params.set('command', view.command)
  const text = params.toString()
  return `${location.pathname}${text ? `?${text}` : ''}`
}

watch(
  () => [view.command, view.range, view.since, view.until, view.sources.join(',')],
  () => history.replaceState(null, '', href()),
)
