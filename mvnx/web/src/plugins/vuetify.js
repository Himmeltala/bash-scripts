// Vuetify 实例与主题：颜色跟浏览器深浅色走，标题栏可以手动切换。

import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { createVuetify } from 'vuetify'
import { useLocalStorage } from '@vueuse/core'

const THEME_KEY = 'mvnx-theme'
const saved = useLocalStorage(THEME_KEY, '', { writeDefaults: false })

// 两个色系共用同一份语义色名，浅色偏素，深色提亮一档。
const light = {
  dark: false,
  colors: {
    background: '#f4f6f8',
    surface: '#ffffff',
    'surface-variant': '#eef1f4',
    'on-surface': '#1d2129',
    'on-surface-variant': '#6b7280',
    primary: '#2563eb',
    'on-primary': '#ffffff',
    ready: '#15803d',
    starting: '#b45309',
    failed: '#b91c1c',
  },
}

const dark = {
  dark: true,
  colors: {
    background: '#14161a',
    surface: '#1c1f24',
    'surface-variant': '#262a30',
    'on-surface': '#e5e7eb',
    'on-surface-variant': '#9ca3af',
    primary: '#60a5fa',
    'on-primary': '#0b1220',
    ready: '#4ade80',
    starting: '#fbbf24',
    failed: '#f87171',
  },
}

export const initialTheme =
  saved.value || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

const vuetify = createVuetify({
  theme: { defaultTheme: initialTheme, themes: { light, dark } },
})

export function rememberTheme(name) {
  saved.value = name
}

export default vuetify
