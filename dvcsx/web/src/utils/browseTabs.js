// 浏览页的文件页签：打开、关闭，以及改名之后跟着换路径。
// 纯函数只摆页签列表，草稿与滚动位置都在各自的编辑器实例里。

export function tabOf(tabs, path) {
  return tabs.find((tab) => tab.path === path) || null
}

// 打开一个文件：已经开着就复用那一个，没有就加到最右边。
export function openTab(tabs, node) {
  const path = String(node.path || '')
  if (!path) return tabs
  const found = tabOf(tabs, path)
  if (found) {
    if (node.size === undefined || node.size === found.size) return tabs
    return updateTab(tabs, path, { size: node.size })
  }
  return [
    ...tabs,
    {
      path,
      name: node.name || path.split('/').pop(),
      type: 'file',
      size: node.size,
      dirty: false,
    },
  ]
}

// 关掉一个页签；关的是当前这个，就停到右边那个，右边没有就左边。
export function closeTab(tabs, path, activePath) {
  const index = tabs.findIndex((tab) => tab.path === path)
  if (index < 0) return { tabs, active: activePath }
  const rest = tabs.filter((tab) => tab.path !== path)
  if (path !== activePath) return { tabs: rest, active: activePath }
  const next = rest[index] || rest[index - 1] || null
  return { tabs: rest, active: next ? next.path : '' }
}

export function updateTab(tabs, path, patch) {
  return tabs.map((tab) => (tab.path === path ? { ...tab, ...patch } : tab))
}

// 改名之后页签跟着走：被动到的那几个会换键，编辑器重新挂载后要再读一次。
export function renameTabs(tabs, from, to, name = '') {
  const moved = []
  const next = tabs.map((tab) => {
    let path = ''
    if (tab.path === from) path = to
    else if (tab.path.startsWith(`${from}/`)) path = to + tab.path.slice(from.length)
    if (!path) return tab
    moved.push({ from: tab.path, to: path })
    const renamed = { ...tab, path, dirty: false }
    if (tab.path === from && name) renamed.name = name
    return renamed
  })
  return { tabs: next, moved }
}

// 改名可能把当前页签一起带走，停靠位置跟着新路径走。
export function followMoved(moved, activePath) {
  const hit = moved.find((item) => item.from === activePath)
  return hit ? hit.to : activePath
}
