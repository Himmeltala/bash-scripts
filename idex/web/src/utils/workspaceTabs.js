// 工作区页签：普通目录只给浏览；仓库再按探测到的能力追加 Node 与 JVM 页签。

export function workspaceTabs(ws) {
  if (!ws || (ws.vcs !== 'git' && ws.vcs !== 'svn')) return ['browse']
  const tabs = ['changes', 'log', 'sync', 'browse']
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
