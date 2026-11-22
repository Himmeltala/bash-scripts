import { createRouter, createWebHistory } from 'vue-router'

// 左侧菜单的一项就是一条路由；新增页面只改这里。
export const PAGES = [
  { key: 'usage', path: '/usage', title: '用量统计', icon: 'mdi-chart-box-outline' },
  { key: 'budget', path: '/budget', title: '预算', icon: 'mdi-wallet-outline' },
  { key: 'data', path: '/data', title: '数据', icon: 'mdi-database-cog-outline' },
  { key: 'settings', path: '/settings', title: '配置管理', icon: 'mdi-cog-outline' },
  { key: 'pricing', path: '/pricing', title: '价格与配置', icon: 'mdi-tune-variant' },
]

const VIEWS = {
  usage: () => import('./views/usage/index.vue'),
  budget: () => import('./views/budget/index.vue'),
  data: () => import('./views/data/index.vue'),
  settings: () => import('./views/settings/index.vue'),
  pricing: () => import('./views/pricing/index.vue'),
}

const routes = [
  { path: '/', redirect: '/usage' },
  ...PAGES.map((item) => ({ path: item.path, name: item.key, component: VIEWS[item.key] })),
  { path: '/:pathMatch(.*)*', redirect: '/usage' },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})
