/*
 * @Author: Himmeltala
 * @Date: 2026-11-26 09:26:41
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-26 09:26:41
 * @FilePath: \idex\web\src\plugins\vuetify.js
 * @Description: Vuetify 实例与主题配置，跟随深浅色并记住手动选择。
 */
// Vuetify 实例与主题：颜色跟浏览器深浅色走，标题栏可以手动切换。

import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { createThemedVuetify } from '@bash-scripts/web-shared/theme'

const { vuetify, initialTheme, rememberTheme } = createThemedVuetify({
  storageKey: 'idex-theme',
  colors: {
    light: { modified: '#b45309', added: '#15803d', deleted: '#b91c1c', unversioned: '#6b7280' },
    dark: { modified: '#fbbf24', added: '#4ade80', deleted: '#f87171', unversioned: '#9ca3af' },
  },
})

export { initialTheme, rememberTheme }
export default vuetify
