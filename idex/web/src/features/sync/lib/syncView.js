/*
 * @Author: Himmeltala
 * @Date: 2026-11-20 01:20:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 21:41:59
 * @FilePath: \idex\web\src\features\sync\lib\syncView.js
 * @Description: 同步页的提交门槛、分支下拉与确认文案，纯函数。
 */
import { statusOf } from '../../../utils/format.js'

export const PULL_MODES = [
  { title: '只快进（推荐）', value: 'ff' },
  { title: '合并', value: 'merge' },
  { title: '变基', value: 'rebase' },
]

// Git 可以把未跟踪文件加进来；SVN 的未纳管、缺失路径与两者的冲突都不能提交。
export function blockedItemsOf(isGit) {
  return isGit ? ['conflicted'] : ['conflicted', 'unversioned', 'missing']
}

export function committableOf(files, isGit) {
  const blocked = blockedItemsOf(isGit)
  return (files || []).filter((item) => !blocked.includes(item.item))
}

export function missingOf(files) {
  return (files || []).filter((item) => item.item === 'missing').map((item) => item.path)
}

export function itemLabelOf(item, isGit) {
  if (isGit && item === 'unversioned') return '未跟踪'
  return statusOf(item).text
}

// Git 的提交只认索引：已暂存的条目只读展示，按钮按索引与冲突判断能不能点。
export function commitDisabledOf({ isGit, busy, writable, message, conflicts, staged, unstaged, picked }) {
  if (busy || writable === false || !String(message || '').trim()) return true
  if (isGit) return (conflicts || []).length > 0 || (!(staged || []).length && !(unstaged || []).length)
  return !(picked || []).length
}

// 分支下拉：本地分支直接切，远端分支选中的是从远端新建同名跟踪分支。
export function branchItemsOf(branches) {
  return (branches || []).map((item) => ({
    title: item.remote
      ? `${item.start_point}（远端，新建跟踪分支）`
      : item.current
        ? `${item.name}（当前）`
        : item.name,
    value: item.remote ? `remote:${item.start_point}` : `local:${item.name}`,
  }))
}

export function findBranchOf(branches, value) {
  return (branches || []).find(
    (item) => (item.remote ? `remote:${item.start_point}` : `local:${item.name}`) === value,
  )
}

export function confirmTitleOf(pending, checkout, isGit) {
  if (pending === 'checkout') {
    return checkout && (checkout.start_point || checkout.create) ? '新建分支并切换' : '切换分支'
  }
  return (
    {
      pull: '拉取远端提交',
      push: '推送当前分支',
      update: '更新工作副本',
      commit: isGit ? '提交到 Git' : '提交到 SVN',
    }[pending] || '确认操作'
  )
}

export function confirmTextOf({
  pending,
  checkout,
  isGit,
  info,
  pullLabel,
  stageAllCommit,
  staged,
  picked,
  message,
}) {
  switch (pending) {
    case 'checkout':
      if (!checkout) return ''
      if (checkout.start_point) {
        return `从 ${checkout.start_point} 新建本地分支 ${checkout.branch}，并切过去。`
      }
      if (checkout.create) {
        return `从当前提交新建分支 ${checkout.branch}，并切过去。`
      }
      return `切换到分支 ${checkout.branch}。工作区有未提交改动且会被覆盖时，Git 会拒绝并留在原分支。`
    case 'pull':
      return `从 ${info.upstream || '远端'} 拉取到 ${info.branch || '当前分支'}，方式：${pullLabel}。`
    case 'push':
      return `把 ${info.branch || '当前分支'} 推到 ${info.upstream || '远端'}。`
    case 'update':
      return '从服务器更新工作副本。'
    case 'commit':
      if (isGit) {
        return stageAllCommit
          ? '索引里还没有内容，要把全部改动暂存后一起提交吗？'
          : `把索引里已暂存的 ${staged.length} 项提交到本地仓库，提交说明：${message.trim()}`
      }
      return `把 ${picked.length} 个路径提交到服务器，提交说明：${message.trim()}`
    default:
      return ''
  }
}
