/*
 * @Author: Himmeltala
 * @Date: 2026-11-24 23:05:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 23:01:03
 * @FilePath: \idex\web\src\features\settings\lib\sections.js
 * @Description: 设置分类登记表：加一类设置就在这里加一条，并补对应的 section 组件。
 */

// savable 表示这类设置有没有「保存」动作；section 组件只需在打开时自己读数据。
export const SETTINGS_SECTIONS = [
  { id: 'search', title: '搜索', icon: 'mdi-magnify', savable: true, load: () => import('../components/sections/SearchSettings.vue') },
  { id: 'editor', title: '编辑器', icon: 'mdi-palette-outline', savable: false, load: () => import('../components/sections/EditorSettings.vue') },
  { id: 'lsp', title: '语言服务器', icon: 'mdi-server-network', savable: false, load: () => import('../components/sections/LspSettings.vue') },
]
