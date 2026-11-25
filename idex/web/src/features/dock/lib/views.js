/*
 * @Author: Himmeltala
 * @Date: 2026-11-25 00:00:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-25 00:00:00
 * @FilePath: \idex\web\src\features\dock\lib\views.js
 * @Description: 底部面板的视图登记表；加功能只在这里加一条。
 */

// available(ws) 返回 false 时这个视图不在当前工作区出现。
export const DOCK_VIEWS = [
  {
    id: 'terminal',
    title: '终端',
    icon: 'mdi-console',
    // 面板从哪一侧呼出：bottom / top / left / right，动画和贴边位置都按它来。
    placement: 'bottom',
    available: (ws) => !!ws,
    load: () => import('../../terminal/components/TerminalPanel.vue'),
  },
  {
    id: 'logs',
    title: '日志',
    icon: 'mdi-alert-circle-outline',
    placement: 'bottom',
    entry: () => import('../../log/components/LogCenter.vue'),
    load: () => import('../../log/components/AppLogPanel.vue'),
  },
]
