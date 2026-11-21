// 四个网页共用的 Vuetify 主题：底座色板一致，各自只补自己的语义色。

import { computed, onBeforeUnmount, onMounted } from 'vue'
import { createVuetify, useTheme } from 'vuetify'
import { useStoredChoice } from './composables/services/useStoredChoice.js'

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

const THEME_NAMES = ['light', 'dark']

// 主题名统一走 useStoredChoice；老版本多包的一层 JSON 引号在这里归一。
function themeChoice(storageKey) {
  if (!storageKey) return null
  const choice = useStoredChoice(storageKey, THEME_NAMES, '')
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (raw && raw.startsWith('"')) {
      const name = JSON.parse(raw)
      if (THEME_NAMES.includes(name)) choice.value = name
    }
  } catch (err) {
    // 读不出来就按没存过处理。
  }
  return choice
}

export function createThemedVuetify({ storageKey, colors = {}, options = {} } = {}) {
  const stored = themeChoice(storageKey)
  const saved = stored ? stored.value : ''
  const initialTheme =
    saved || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  const themes = {
    light: { dark: false, colors: { ...BASE.light, ...(colors.light || {}) } },
    dark: { dark: true, colors: { ...BASE.dark, ...(colors.dark || {}) } },
  }
  const vuetify = createVuetify({ ...options, theme: { defaultTheme: initialTheme, themes } })

  function rememberTheme(name) {
    if (stored) stored.value = name
  }

  return { vuetify, initialTheme, rememberTheme }
}

// 标题栏的深浅色开关。followSystem 为真时，用户没手动选过就继续跟系统走；
// 一旦切换过（storageKey 里有值），系统变化不再覆盖用户的选择。
export function useThemeToggle({ storageKey, rememberTheme, followSystem = false } = {}) {
  const theme = useTheme()
  const dark = computed(() => theme.global.current.value.dark)
  const stored = themeChoice(storageKey)
  let media = null

  function savedTheme() {
    return stored ? stored.value : ''
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
