// 四个网页共用的 Vuetify 主题：底座色板一致，各自只补自己的语义色。

import { computed, onBeforeUnmount, onMounted } from 'vue'
import { createVuetify, useTheme } from 'vuetify'

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

// 标题栏的深浅色开关。followSystem 为真时，用户没手动选过就继续跟系统走；
// 一旦切换过（storageKey 里有值），系统变化不再覆盖用户的选择。
export function useThemeToggle({ storageKey, rememberTheme, followSystem = false } = {}) {
  const theme = useTheme()
  const dark = computed(() => theme.global.current.value.dark)
  let media = null

  function savedTheme() {
    try {
      return storageKey ? window.localStorage.getItem(storageKey) : ''
    } catch (err) {
      return ''
    }
  }

  function setTheme(name) {
    theme.global.name.value = name
    if (rememberTheme) rememberTheme(name)
  }

  function toggle() {
    setTheme(dark.value ? 'light' : 'dark')
  }

  function onSystemChange(event) {
    if (savedTheme()) return
    theme.global.name.value = event.matches ? 'dark' : 'light'
  }

  onMounted(() => {
    if (!followSystem || typeof window === 'undefined' || !window.matchMedia) return
    if (savedTheme()) return
    media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener?.('change', onSystemChange)
  })

  onBeforeUnmount(() => {
    media?.removeEventListener?.('change', onSystemChange)
    media = null
  })

  return { theme, dark, toggle, setTheme }
}
