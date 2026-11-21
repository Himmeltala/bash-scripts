// 视图状态：报表、范围、来源与排序同步到地址栏，刷新页面、分享链接与前后退都能还原。

import { reactive, watch } from 'vue'
import { formatDate, startOfWeek } from '@bash-scripts/web-shared/format'
import router from '../../../router'
import { SOURCE_LIST } from './format'

export const SOURCES = SOURCE_LIST

export const COMMANDS = [
  { key: 'daily', name: '按天汇总' },
  { key: 'session', name: '按会话汇总' },
  { key: 'hour', name: '按小时汇总' },
  { key: 'project', name: '按项目汇总' },
  { key: 'api', name: '按 API 汇总' },
]

export const RANGES = [
  { key: '1', name: '今天' },
  { key: 'yesterday', name: '昨天' },
  { key: 'week', name: '本周' },
  { key: 'month', name: '本月' },
  { key: '7', name: '近 7 天' },
  { key: '14', name: '近 14 天' },
  { key: '30', name: '近 30 天' },
  { key: 'all', name: '全部历史' },
  { key: 'custom', name: '自定义' },
]

export const view = reactive({
  command: 'daily',
  range: '14',
  since: '',
  until: '',
  sources: SOURCE_LIST.map((item) => item.key),
})

function pick(list, value, fallback) {
  return list.some((item) => item.key === value) ? value : fallback
}

export function applyQuery(query) {
  const picked = String(query.source || '').split(',').filter(Boolean)
  view.command = pick(COMMANDS, query.command, 'daily')
  view.range = pick(RANGES, query.range || query.days, '14')
  view.since = query.since || ''
  view.until = query.until || ''
  view.sources = SOURCE_LIST.filter((item) =>
    picked.length ? picked.includes(item.key) : true,
  ).map((item) => item.key)
}

applyQuery(router.currentRoute.value.query)

// 请求参数：没选满来源时只带选中的那几个，命令行的 -s 语义。
export function query(extra = {}) {
  const params = new URLSearchParams(extra)
  params.set('command', view.command)
  if (view.range === 'custom') {
    if (view.since) params.set('since', view.since)
    if (view.until) params.set('until', view.until)
  } else if (view.range === 'yesterday') {
    const date = new Date()
    date.setDate(date.getDate() - 1)
    const day = formatDate(date)
    params.set('since', day)
    params.set('until', day)
  } else if (view.range === 'week' || view.range === 'month') {
    const today = new Date()
    const start =
      view.range === 'week'
        ? startOfWeek(today)
        : new Date(today.getFullYear(), today.getMonth(), 1)
    params.set('since', formatDate(start))
    params.set('until', formatDate(today))
  } else if (view.range === 'all') {
    params.set('all', '1')
  } else {
    params.set('days', view.range)
  }
  if (view.sources.length < SOURCES.length) params.set('source', view.sources.join(','))
  return params
}

// 当前筛选条件对应的地址栏参数，页面切换与首次进入时都由它写回。
export function urlParams() {
  const params = query()
  params.set('range', view.range)
  params.delete('command')
  if (view.command !== 'daily') params.set('command', view.command)
  return Object.fromEntries(params)
}

// 筛选条件只替换当前记录，不新增历史；回退键仍按页面前进后退。
export function syncUrl() {
  router.replace({ name: 'usage', query: urlParams() })
}

watch(
  () => [view.command, view.range, view.since, view.until, view.sources.join(',')],
  () => {
    if (router.currentRoute.value.name === 'usage') syncUrl()
  },
)

// 地址栏变化（手动改、前后退）反过来落到筛选条件上。
watch(
  () => router.currentRoute.value.query,
  (value) => {
    if (router.currentRoute.value.name === 'usage') applyQuery(value)
  },
)
