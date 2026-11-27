/*
 * @Author: Himmeltala
 * @Date: 2026-11-28 10:30:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-28 10:30:00
 * @FilePath: \idex\web\src\features\settings\lib\sections.js
 * @Description: 设置弹窗的静态部分：分类图标与不存设置的只读诊断分类。
 */

// 分类图标按登记表里的组名取；没有登记的组用通用图标。
export const GROUP_ICONS = {
  搜索: 'mdi-magnify',
  编辑器: 'mdi-palette-outline',
  终端: 'mdi-console',
  动画: 'mdi-transition',
  顶栏: 'mdi-view-compact-outline',
  快捷键: 'mdi-keyboard-outline',
}

export function groupIcon(title) {
  return GROUP_ICONS[title] || 'mdi-cog-outline'
}

// 诊断只读：语言服务器的可用性不是设置，不进入保存流程。
export const DIAGNOSTIC_SECTIONS = [
  {
    id: 'lsp',
    title: '语言服务器',
    icon: 'mdi-server-network',
    load: () => import('../components/sections/LspSettings.vue'),
  },
]
