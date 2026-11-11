// Vuetify 实例与主题：页面用 Vuetify 3 组件画，颜色跟浏览器深浅色走，标题栏可以手动切换。

import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { createVuetify } from 'vuetify'

const THEME_KEY = 'tokx-theme'

function savedTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || ''
  } catch (err) {
    return ''
  }
}

// 两个色系共用同一份语义色名，浅色偏素，深色提亮一档。
const light = {
  dark: false,
  colors: {
    background: '#f4f6f8',
    surface: '#ffffff',
    'surface-bright': '#ffffff',
    'surface-variant': '#eef1f4',
    'on-surface': '#1d2129',
    'on-surface-variant': '#6b7280',
    primary: '#2563eb',
    'on-primary': '#ffffff',
    peak: '#f59e0b',
    off: '#2563eb',
    cached: '#eef4ff',
  },
}

const dark = {
  dark: true,
  colors: {
    background: '#14161a',
    surface: '#1c1f24',
    'surface-bright': '#262a30',
    'surface-variant': '#262a30',
    'on-surface': '#e5e7eb',
    'on-surface-variant': '#9ca3af',
    primary: '#60a5fa',
    'on-primary': '#0b1220',
    peak: '#fbbf24',
    off: '#60a5fa',
    cached: '#1f2733',
  },
}

const wanted = savedTheme()
export const initialTheme =
  wanted || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

const vuetify = createVuetify({
  theme: { defaultTheme: initialTheme, themes: { light, dark } },
})

export function rememberTheme(name) {
  try {
    localStorage.setItem(THEME_KEY, name)
  } catch (err) {
    // 隐私模式下写不进去，主题只在本次会话里生效。
  }
}

export default vuetify
