/*
 * @Author: Himmeltala
 * @Date: 2026-11-24 22:28:38
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 23:09:46
 * @FilePath: \idex\web\src\utils\logs.js
 * @Description: 页面写日志的入口：把前端提示与异常发给服务端持久化，失败不打扰用户。
 */
import { api } from './api'

export function logToServer(level, message, detail = '', source = 'frontend') {
  const text = String(message || '').trim()
  if (!text) return
  api
    .addLog({ level, message: text, detail: String(detail || ''), source })
    .catch(() => {
      // 服务端不可用时退回只有提示条，不在这里再弹错误。
    })
}
