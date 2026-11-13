// 四个网页共用的 Vuetify 主题：底座色板一致，各自只补自己的语义色。

import { createVuetify } from 'vuetify'

const BASE = {
  light: {
    background: '#f4f6f8',
    surface: '#ffffff',
    'surface-variant': '#eef1f4',
    'on-surface': '#1d2129',
    'on-surface-variant': '#6b7280',
    primary: '#2563eb',
    'on-primary': '#ffffff',
  },
  dark: {
    background: '#14161a',
    surface: '#1c1f24',
    'surface-variant': '#262a30',
    'on-surface': '#e5e7eb',
    'on-surface-variant': '#9ca3af',
    primary: '#60a5fa',
    'on-primary': '#0b1220',
  },
}

// 老写法用 useLocalStorage 存的是 JSON 字符串，也有的直接存裸字符串，两种都认。
function readSaved(storageKey) {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return ''
    if (!raw.startsWith('"')) return raw
    const value = JSON.parse(raw)
    return typeof value === 'string' ? value : ''
  } catch (err) {
    return ''
  }
}

export function createThemedVuetify({ storageKey, colors = {}, options = {} } = {}) {
  const saved = readSaved(storageKey)
  const initialTheme =
    saved || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  const themes = {
    light: { dark: false, colors: { ...BASE.light, ...(colors.light || {}) } },
    dark: { dark: true, colors: { ...BASE.dark, ...(colors.dark || {}) } },
  }
  const vuetify = createVuetify({ ...options, theme: { defaultTheme: initialTheme, themes } })

  function rememberTheme(name) {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(name))
    } catch (err) {
      // 隐私模式下写不进去，主题只在这次会话里生效。
    }
  }

  return { vuetify, initialTheme, rememberTheme }
}
