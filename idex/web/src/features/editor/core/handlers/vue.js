/*
 * @Author: Himmeltala
 * @Date: 2026-11-24 16:05:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 21:41:59
 * @FilePath: \idex\web\src\features\editor\core\handlers\vue.js
 * @Description: Vue 单文件组件，脚本部分交给带 Vue 插件的 TypeScript 服务器。
 */

export default {
  id: 'vue',
  title: 'Vue',
  extensions: ['vue'],
  label: () => 'Vue',
  server: 'vue',
  cmLanguage: () => 'vue',
  formatOptions() {
    return { tabSize: 4, insertSpaces: true }
  },
}
