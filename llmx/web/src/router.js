import { createRouter, createWebHistory } from 'vue-router'

// 左侧菜单的一项就是一条路由；新增页面只改这里。
export const PAGES = [
  { key: 'usage', path: '/usage', title: '用量统计', icon: 'mdi-chart-box-outline' },
  { key: 'insights', path: '/insights', title: '洞察', icon: 'mdi-lightbulb-on-outline' },
  { key: 'budget', path: '/budget', title: '预算', icon: 'mdi-wallet-outline' },
  { key: 'data', path: '/data', title: '数据', icon: 'mdi-database-cog-outline' },
  { key: 'settings', path: '/settings', title: '配置管理', icon: 'mdi-cog-outline' },
  { key: 'pricing', path: '/pricing', title: '价格与配置', icon: 'mdi-tune-variant' },
]

// 旧地址是 /?page=xxx，跳到新路径时带上其余参数。
function fromLegacy(to, fallback) {
  const hit = PAGES.find((item) => item.key === to.query.page)
  const query = { ...to.query }
  delete query.page
  return { path: hit ? hit.path : fallback, query }
}

const VIEWS = {
  usage: () => import('./views/usage/index.vue'),
  insights: () => import('./views/insights/index.vue'),
  budget: () => import('./views/budget/index.vue'),
  data: () => import('./views/data/index.vue'),
  settings: () => import('./views/settings/index.vue'),
  pricing: () => import('./views/pricing/index.vue'),
}

const routes = [
  { path: '/', redirect: (to) => fromLegacy(to, '/usage') },
  ...PAGES.map((item) => ({ path: item.path, name: item.key, component: VIEWS[item.key] })),
  { path: '/:pathMatch(.*)*', redirect: (to) => fromLegacy(to, '/usage') },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})
