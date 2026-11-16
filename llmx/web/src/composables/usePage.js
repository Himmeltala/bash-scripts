// 左侧菜单的页面状态：当前页写在地址栏 page 参数里，刷新与分享都能落回同一页。

import { reactive } from 'vue'

export const PAGES = [
  { key: 'usage', title: '用量统计', icon: 'mdi-chart-box-outline' },
  { key: 'settings', title: '配置管理', icon: 'mdi-cog-outline' },
  { key: 'pricing', title: '价格与配置', icon: 'mdi-tune-variant' },
]

function initialPage() {
  const value = new URLSearchParams(location.search).get('page')
  return PAGES.some((item) => item.key === value) ? value : 'usage'
}

export const page = reactive({ key: initialPage() })

// 改地址栏：page 由这里统一写，extra 里值为空表示删掉这个参数。
export function writePageUrl(extra = {}) {
  const params = new URLSearchParams(location.search)
  params.set('page', page.key)
  for (const [key, value] of Object.entries(extra)) {
    if (value === '' || value === null || value === undefined || value === false) params.delete(key)
    else params.set(key, value)
  }
  const text = params.toString()
  history.replaceState(null, '', `${location.pathname}${text ? `?${text}` : ''}`)
}

// 页面自己维护的筛选参数：先删掉旧值，再按当前状态写回去。
export function replaceParams(keys, extra = {}) {
  const params = new URLSearchParams(location.search)
  for (const key of keys) params.delete(key)
  params.set('page', page.key)
  for (const [key, value] of Object.entries(extra)) {
    if (value === '' || value === null || value === undefined || value === false) continue
    params.set(key, value)
  }
  const text = params.toString()
  history.replaceState(null, '', `${location.pathname}${text ? `?${text}` : ''}`)
}
