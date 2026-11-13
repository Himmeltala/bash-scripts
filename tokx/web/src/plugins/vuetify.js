// Vuetify 实例与主题：页面用 Vuetify 3 组件画，颜色跟浏览器深浅色走，标题栏可以手动切换。

import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { zhHans } from 'vuetify/locale'
import { createThemedVuetify } from '@bash-scripts/web-shared/theme'

const { vuetify, initialTheme, rememberTheme } = createThemedVuetify({
  storageKey: 'tokx-theme',
  options: { locale: { locale: 'zhHans', fallback: 'zhHans', messages: { zhHans } } },
  colors: {
    light: { 'surface-bright': '#ffffff', peak: '#f59e0b', off: '#2563eb', cached: '#eef4ff' },
    dark: { 'surface-bright': '#262a30', peak: '#fbbf24', off: '#60a5fa', cached: '#1f2733' },
  },
})

export { initialTheme, rememberTheme }
export default vuetify
