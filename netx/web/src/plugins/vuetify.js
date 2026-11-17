// Vuetify 实例与主题：颜色跟浏览器深浅色走，标题栏可以手动切换。

import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { createThemedVuetify } from '@bash-scripts/web-shared/theme'

const { vuetify, initialTheme, rememberTheme } = createThemedVuetify({
  storageKey: 'netx-theme',
  colors: {
    light: { live: '#15803d', done: '#6b7280' },
    dark: { live: '#4ade80', done: '#9ca3af' },
  },
})

export { initialTheme, rememberTheme }
export default vuetify
