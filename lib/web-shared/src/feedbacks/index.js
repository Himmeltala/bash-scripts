/*
 * @Author: Himmeltala
 * @Date: 2026-11-17 23:22:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-26 17:05:00
 * @FilePath: \lib\web-shared\src\feedbacks\index.js
 * @Description: 反馈类组件的入口：对话框、提示条与提示状态。
 */
export { default as ContextMenu } from './commons/ContextMenu.vue'
export { default as FloatingDialog } from './commons/FloatingDialog.vue'
export { default as ToastHost } from './commons/ToastHost.vue'
export { useToast } from '../composables/commons/useToast.js'
