/*
 * @Author: Himmeltala
 * @Date: 2026-11-27 10:04:22
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-27 10:04:22
 * @FilePath: \idex\web\src\features\workspaces\lib\recent.js
 * @Description: 最近打开的工作区顺序：只存 id，名称与路径每次从登记表取，改名不移出列表。
 */

export const RECENT_LIMIT = 12

// 打开一个工作区就挪到最前面，重复项只留一条，超出上限丢掉最旧的。
export function pushRecent(ids, id, limit = RECENT_LIMIT) {
  const list = Array.isArray(ids) ? ids.filter((item) => item !== id) : []
  if (!id) return list
  list.unshift(id)
  return list.slice(0, Math.max(1, limit))
}

// 登记表里已经没有的（移出列表、登记表被清空）一并清掉，菜单里不留死项。
export function pruneRecent(ids, validIds) {
  const valid = validIds instanceof Set ? validIds : new Set(validIds || [])
  return (Array.isArray(ids) ? ids : []).filter((id) => valid.has(id))
}

// 版本库类型对应的图标与说明，与左侧列表的口径一致。
export function vcsMeta(vcs) {
  if (vcs === 'git') return { icon: 'mdi-git', label: 'Git 仓库' }
  if (vcs === 'svn') return { icon: 'mdi-source-repository', label: 'SVN 工作副本' }
  return { icon: 'mdi-folder-outline', label: '普通目录' }
}
