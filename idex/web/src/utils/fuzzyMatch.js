/*
 * @Author: Himmeltala
 * @Date: 2026-11-19 02:10:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-19 02:10:00
 * @FilePath: \idex\web\src\composables\fuzzyMatch.js
 * @Description: 快速打开的模糊匹配：按子序列命中，命中越靠前越靠前。
 */

// 查询里的字符按顺序出现在文本里就算命中；返回最后一个命中位置加一，越小越靠前，没命中返回 -1。
export function fuzzyScore(query, text) {
  const needle = String(query || '').toLowerCase()
  const hay = String(text || '').toLowerCase()
  if (!needle) return 0
  let index = 0
  for (const char of needle) {
    const hit = hay.indexOf(char, index)
    if (hit < 0) return -1
    index = hit + 1
  }
  return index
}

export function filterPaths(paths, query, limit = 100) {
  const rows = []
  for (const path of paths || []) {
    const score = fuzzyScore(query, path)
    if (score < 0) continue
    rows.push({ path, score })
  }
  rows.sort((a, b) => a.score - b.score || a.path.localeCompare(b.path))
  return rows.slice(0, limit).map((row) => row.path)
}
