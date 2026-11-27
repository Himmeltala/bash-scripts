/*
 * @Author: Himmeltala
 * @Date: 2026-11-28 12:40:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-28 12:40:00
 * @FilePath: \idex\web\src\features\browse\lib\browseSelection.js
 * @Description: 多选的纯逻辑：加入/移出与是否同目录，压缩和打包下载都要求同目录。
 */

export function togglePath(list, path) {
  const next = new Set(list || [])
  if (!path) return [...next]
  if (next.has(path)) next.delete(path)
  else next.add(path)
  return [...next]
}

// 同一父目录才允许打成一个 zip：包内条目直接是这些名字。
export function sharesParent(paths) {
  const dirs = new Set()
  for (const path of paths || []) {
    const text = String(path || '')
    const index = text.lastIndexOf('/')
    dirs.add(index < 0 ? '' : text.slice(0, index))
    if (dirs.size > 1) return false
  }
  return true
}
