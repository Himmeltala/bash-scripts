/*
 * @Author: Himmeltala
 * @Date: 2026-11-24 22:28:38
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 22:58:36
 * @FilePath: \idex\web\src\utils\notice.js
 * @Description: 全页提示条，错误与告警同时写入日志面板。
 */
// 全页提示条：页面与各面板共用 App 里那一条 snackbar，反馈不自己搭元素。
// 错误与告警同时记进日志面板，提示条消失后仍能回查。
import { useToast } from '@bash-scripts/web-shared/feedbacks'
import { addLog } from './logs'

const base = useToast()

export const snack = base.snack
export const close = base.close

export function toast(text, color = 'primary', detail = '') {
  base.toast(text, color)
  const level = color === 'error' ? 'error' : color === 'warning' ? 'warning' : 'info'
  addLog(level, text, detail)
}
