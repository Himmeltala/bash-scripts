/*
 * @Author: Himmeltala
 * @Date: 2026-11-28 10:09:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-28 10:09:00
 * @FilePath: \idex\web\src\features\settings\lib\settingsView.js
 * @Description: 设置弹窗的纯视图逻辑：按登记表分组、搜索与「只看已修改」过滤。
 */

// 搜索词按空格拆开，每个词都要在标题、说明或键里出现；@modified 单独当过滤开关。
export function parseQuery(text) {
  const words = []
  let modified = false
  for (const part of String(text || '').trim().toLowerCase().split(/\s+/)) {
    if (!part) continue
    if (part === '@modified' || part === '@修改') modified = true
    else words.push(part)
  }
  return { words, modified }
}

export function matchesSetting(item, words) {
  if (!words.length) return true
  const haystack = [item.label, item.description, item.key, item.group, item.section]
    .join(' ')
    .toLowerCase()
  return words.every((word) => haystack.includes(word))
}

export function filterSettings(schema, text, options = {}) {
  const { words, modified } = parseQuery(text)
  const dirty = options.dirty || new Set()
  const onlyModified = options.onlyModified || modified
  return (schema || []).filter((item) => {
    if (onlyModified && !dirty.has(item.key)) return false
    return matchesSetting(item, words)
  })
}

// 按分类分组，组内保持登记表的顺序；分组顺序按首次出现决定。
export function groupSettings(schema) {
  const groups = []
  const index = new Map()
  for (const item of schema || []) {
    const title = item.group || '其他'
    let group = index.get(title)
    if (!group) {
      group = { title, items: [] }
      index.set(title, group)
      groups.push(group)
    }
    group.items.push(item)
  }
  return groups
}

// 分类里是否有一项已修改，左侧导航用来点一个小圆点。
export function groupModified(group, dirty) {
  return (group.items || []).some((item) => dirty.has(item.key))
}
