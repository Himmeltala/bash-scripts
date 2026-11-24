/*
 * @Author: Himmeltala
 * @Date: 2026-11-19 02:10:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-19 02:10:00
 * @FilePath: \\src\\components\\browse\\fuzzyMatch.js
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

// 分数小的在前，同分按路径排；只留得住前 limit 条，不必为两万条路径全排序。
function better(a, b) {
  return a.score < b.score || (a.score === b.score && a.path.localeCompare(b.path) < 0)
}

export function filterPaths(paths, query, limit = 100) {
  if (limit <= 0) return []
  const best = []
  for (const path of paths || []) {
    const score = fuzzyScore(query, path)
    if (score < 0) continue
    const row = { path, score }
    if (best.length >= limit && !better(row, best[best.length - 1])) continue
    let low = 0
    let high = best.length
    while (low < high) {
      const mid = (low + high) >> 1
      if (better(best[mid], row)) low = mid + 1
      else high = mid
    }
    best.splice(low, 0, row)
    if (best.length > limit) best.pop()
  }
  return best.map((row) => row.path)
}
