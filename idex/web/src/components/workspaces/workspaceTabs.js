/*
 * @Author: Himmeltala
 * @Date: 2026-11-23 23:09:19
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-23 23:09:19
 * @FilePath: \\src\\components\\workspaces\\workspaceTabs.js
 * @Description: 工作区页签的生成规则：按版本库类型与探测到的引擎能力决定显示哪些页签。
*/

// 工作区页签：仓库有变更、日志与同步，普通目录只有浏览；
// 两者都按探测到的能力追加 Node 与 JVM 页签。

export function workspaceTabs(ws) {
  if (!ws) return ['browse']
  const vcs = ws.vcs === 'git' || ws.vcs === 'svn'
  const tabs = vcs ? ['changes', 'log', 'sync', 'browse'] : ['browse']
  // 旧记录没有 tools 字段时为 null，探测过但没有能力时是空对象。
  if (ws.tools && ws.tools.node) tabs.push('node')
  if (ws.tools && ws.tools.jvm) tabs.push('jvm')
  return tabs
}

export function needsToolDetection(ws) {
  return !!ws && ws.tools == null
}

// JVM 工作区类型只影响页签与启动参数，标签就这两个词。
export function jvmKindLabel(kind) {
  if (kind === 'mvn') return 'Maven'
  if (kind === 'gradle') return 'Gradle'
  return ''
}
