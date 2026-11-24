/*
 * @Author: Himmeltala
 * @Date: 2026-11-20 00:15:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 21:41:59
 * @FilePath: \idex\web\src\features\editor\core\diagnostics.js
 * @Description: 诊断的级别表与行号圆点、分类统计的纯函数。
 */

export const SEVERITY_ICONS = {
  error: 'mdi-alert-circle',
  warning: 'mdi-alert',
  info: 'mdi-information',
  hint: 'mdi-lightbulb-on-outline',
}

// 问题弹窗里的分类，只列这一份文件里真有的级别。
export const PROBLEM_LEVELS = [
  { id: 'error', label: '错误', icon: 'mdi-alert-circle' },
  { id: 'warning', label: '警告', icon: 'mdi-alert' },
  { id: 'info', label: '信息', icon: 'mdi-information' },
  { id: 'hint', label: '提示', icon: 'mdi-lightbulb-on-outline' },
]

// 行号前的圆点：一行取最重的那一级，error 一旦定下就不再被覆盖。
export function markersOf(items) {
  const map = {}
  for (const item of items || []) {
    const line = (item.line || 0) + 1
    const level = item.severity === 'error' ? 'error' : item.severity === 'warning' ? 'warning' : 'info'
    if (map[line] === 'error') continue
    if (!map[line] || level === 'error') map[line] = level
  }
  return map
}

export function statsOf(items) {
  return PROBLEM_LEVELS.map((level) => ({
    ...level,
    count: (items || []).filter((item) => item.severity === level.id).length,
  })).filter((level) => level.count > 0)
}
