/*
 * @Author: Himmeltala
 * @Date: 2026-11-24 22:28:38
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 22:28:38
 * @FilePath: \idex\web\src\utils\logs.js
 * @Description: 页面内的错误与告警记录：只留最近若干条，存在本地，供顶栏日志面板查看。
 */
import { reactive } from 'vue'

const KEY = 'idex.logs'
const MAX = 200
const DETAIL_MAX = 4000

function load() {
  try {
    const items = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(items) ? items.slice(0, MAX) : []
  } catch (err) {
    return []
  }
}

export const logs = reactive({ items: load() })

let seq = 0

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(logs.items))
  } catch (err) {
    // 存不下就只在本次页面里保留。
  }
}

export function addLog(level, message, detail = '') {
  const text = String(message || '').trim()
  if (!text) return
  seq += 1
  logs.items.unshift({
    id: `${Date.now()}-${seq}`,
    at: Date.now(),
    level: level === 'warning' ? 'warning' : 'error',
    message: text,
    detail: String(detail || '').slice(-DETAIL_MAX),
  })
  if (logs.items.length > MAX) logs.items.length = MAX
  save()
}

export function clearLogs() {
  logs.items.splice(0, logs.items.length)
  save()
}
