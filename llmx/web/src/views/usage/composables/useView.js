// 视图状态：报表、范围、来源与排序同步到地址栏，刷新页面或分享链接都能还原。

import { reactive, watch } from 'vue'
import { page, replaceParams } from '../../../composables/usePage'
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

const URL_KEYS = ['command', 'range', 'days', 'all', 'since', 'until', 'source']

// 当前筛选条件对应的地址栏参数，页面切换与首次进入时都由它写回。
export function urlParams() {
  const params = query()
  params.set('range', view.range)
  params.delete('command')
  if (view.command !== 'daily') params.set('command', view.command)
  return Object.fromEntries(params)
}

export function syncUrl() {
  replaceParams(URL_KEYS, urlParams())
}

watch(
  () => [view.command, view.range, view.since, view.until, view.sources.join(',')],
  () => {
    // 只有停在用量页时才改写地址栏，免得覆盖配置页的页签参数。
    if (page.key === 'usage') syncUrl()
  },
)
