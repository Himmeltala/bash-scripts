// Vuetify 实例与主题：颜色跟浏览器深浅色走，标题栏可以手动切换。

import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { createThemedVuetify } from '@bash-scripts/web-shared/theme'

const { vuetify, initialTheme, rememberTheme } = createThemedVuetify({
  storageKey: 'nodex-theme',
  colors: {
    light: { ready: '#15803d', starting: '#b45309', failed: '#b91c1c' },
    dark: { ready: '#4ade80', starting: '#fbbf24', failed: '#f87171' },
  },
})

export { initialTheme, rememberTheme }
export default vuetify
