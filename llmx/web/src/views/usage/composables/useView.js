// 视图状态：报表、范围、来源、模型、项目与自定义日期存在浏览器里，刷新与来回切页都保持原样。

import { useLocalStorage } from '@vueuse/core'
import { formatDate, startOfWeek } from '@bash-scripts/web-shared/format'
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

const ALL_SOURCES = SOURCE_LIST.map((item) => item.key)

export const view = useLocalStorage(
  'llmx.usage-view',
  {
    command: 'daily',
    range: '14',
    since: '',
    until: '',
    sources: ALL_SOURCES.slice(),
    models: [],
    projects: [],
  },
  { mergeDefaults: true, writeDefaults: false }
)

// 请求参数：没选满来源时只带选中的那几个，命令行的 -s 语义。
export function query(extra = {}) {
  const state = view.value
  const params = new URLSearchParams(extra)
  params.set('command', state.command)
  if (state.range === 'custom') {
    if (state.since) params.set('since', state.since)
    if (state.until) params.set('until', state.until)
  } else if (state.range === 'yesterday') {
    const date = new Date()
    date.setDate(date.getDate() - 1)
    const day = formatDate(date)
    params.set('since', day)
    params.set('until', day)
  } else if (state.range === 'week' || state.range === 'month') {
    const today = new Date()
    const start =
      state.range === 'week'
        ? startOfWeek(today)
        : new Date(today.getFullYear(), today.getMonth(), 1)
    params.set('since', formatDate(start))
    params.set('until', formatDate(today))
  } else if (state.range === 'all') {
    params.set('all', '1')
  } else {
    params.set('days', state.range)
  }
  if (state.sources.length < SOURCES.length) params.set('source', state.sources.join(','))
  if (state.models.length) params.set('model', state.models.join(','))
  if (state.projects.length) params.set('project', state.projects.join(','))
  return params
}
