/*
 * @Author: Himmeltala
 * @Date: 2026-11-20 01:05:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-20 01:05:00
 * @FilePath: \\src\\components\\changes\\changesView.js
 * @Description: 变更页的分组、差异口径与行内动作，纯函数。
 */

export const GROUP_DEFS = [
  { key: 'staged', title: '已暂存', action: '全部取消', icon: 'mdi-minus-circle-outline' },
  { key: 'unstaged', title: '更改', action: '全部暂存', icon: 'mdi-plus-circle-outline' },
  { key: 'conflicts', title: '冲突', action: '' },
]

// SVN 没有索引，只有一份“更改”；未纳管与刚纳入的行各自给纳入、撤回纳入的动作。
export function groupsFor(isGit) {
  return isGit ? GROUP_DEFS : [{ key: 'unstaged', title: '更改', action: '' }]
}

// 差异口径：已暂存取索引对 HEAD，冲突取对 HEAD，其余取工作区对索引。
export function scopeOf(group) {
  if (group === 'staged') return 'staged'
  if (group === 'conflicts') return 'head'
  return 'worktree'
}

export function keyOf(group, path) {
  return `${scopeOf(group)}:${path}`
}

export function rowActionOf(key, file, isGit) {
  if (!isGit) {
    if (file.item === 'unversioned') return { icon: 'mdi-plus-circle-outline', title: '纳入版本控制' }
    if (file.item === 'added') {
      return { icon: 'mdi-minus-circle-outline', title: '取消纳入版本控制，文件留在工作副本里' }
    }
    return null
  }
  if (key === 'staged') return { icon: 'mdi-minus-circle-outline', title: '取消暂存' }
  if (key === 'conflicts') return { icon: 'mdi-check-circle-outline', title: '标记已解决' }
  return { icon: 'mdi-plus-circle-outline', title: '暂存' }
}
