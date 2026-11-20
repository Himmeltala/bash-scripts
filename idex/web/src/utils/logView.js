/*
 * @Author: Himmeltala
 * @Date: 2026-11-20 00:45:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-20 00:45:00
 * @FilePath: \idex\web\src\composables\logView.js
 * @Description: 提交列表上的分支标签、推送状态、版本号与文件动作配色。
 */
import { actionOf } from './format.js'

// 时间线分列交给纯函数，换主题只是换一套颜色。
export const LANE_COLORS = {
  light: ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d'],
  dark: ['#60a5fa', '#4ade80', '#fbbf24', '#f87171', '#c084fc', '#22d3ee', '#f472b6', '#a3e635'],
}

// 提交上挂的分支与标签由后端一次查好；只是当前提交不在任何分支上时补一个 HEAD。
export function refsOf(entry, isGit, remote) {
  if (!isGit) return []
  const marks = []
  const seen = new Set()
  for (const ref of entry.labels || []) {
    if (seen.has(ref.name)) continue
    seen.add(ref.name)
    if (ref.kind === 'head') {
      marks.push({ kind: 'head', icon: 'mdi-source-branch', text: ref.name, title: '本地分支' })
    } else if (ref.kind === 'tag') {
      marks.push({ kind: 'tag', icon: 'mdi-tag-outline', text: ref.name, title: '标签' })
    } else {
      marks.push({
        kind: 'upstream',
        icon: 'mdi-cloud-outline',
        text: ref.name,
        title: '远端跟踪分支',
      })
    }
  }
  // 老服务端不给 labels 时按原来的 HEAD / 上游标记显示。
  if (!entry.labels) {
    if (entry.head) {
      marks.push({
        kind: 'head',
        icon: 'mdi-source-branch',
        text: (remote && remote.branch) || 'HEAD',
        title: '本地分支当前提交',
      })
    }
    if (entry.remote_tip && remote && remote.upstream) {
      marks.push({
        kind: 'upstream',
        icon: 'mdi-cloud-outline',
        text: remote.upstream,
        title: '远端跟踪分支的最新提交',
      })
    }
  }
  if (entry.head && !marks.some((mark) => mark.kind === 'head')) {
    marks.unshift({ kind: 'head', icon: 'mdi-source-branch', text: 'HEAD', title: '当前提交' })
  }
  return marks
}

// 提交相对本地分支与远端分支的位置；没有远端跟踪分支时不做判断。
export function stateOf(entry, isGit) {
  if (!isGit) {
    if (entry.local) return null
    return {
      kind: 'pending',
      icon: 'mdi-cloud-download-outline',
      text: '待更新',
      title: '工作副本还没有这个版本',
    }
  }
  if (entry.pushed === undefined) return null
  if (!entry.local) {
    return {
      kind: 'pending',
      icon: 'mdi-cloud-download-outline',
      text: '待拉取',
      title: '这个提交还只在远端分支上',
    }
  }
  if (!entry.pushed) {
    return {
      kind: 'local',
      icon: 'mdi-cloud-upload-outline',
      text: '未推送',
      title: '这个提交还没进远端分支',
    }
  }
  return null
}

// SVN 的版本号前面带 r，Git 给的是完整 sha，列表上只显示前 7 位。
export function revLabel(rev, isGit) {
  return isGit ? String(rev).slice(0, 7) : `r${rev}`
}

export function tone(action) {
  return `rgb(var(--v-theme-${actionOf(action).color}))`
}
