/*
 * @Author: Himmeltala
 * @Date: 2026-11-18 23:19:43
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-18 23:19:43
 * @FilePath: \idex\web\src\components\browse\browseSearchTree.js
 * @Description: 把搜索命中的平铺结果按目录归成树，并摊平成能逐行渲染的列表。
 */

function dirNode(name, path) {
  return { type: 'dir', name, path, children: [] }
}

// 命中的文件按所在目录逐层归组；同一个文件的多处内容命中并到它的 hits 里。
export function buildSearchTree(matches) {
  const root = dirNode('', '')
  const files = new Map()
  for (const match of Array.isArray(matches) ? matches : []) {
    const path = String((match && match.path) || '')
    if (!path) continue
    let node = files.get(path)
    if (!node) {
      node = {
        type: 'file',
        path,
        name: match.name || path.split('/').pop(),
        size: match.size,
        hits: [],
      }
      files.set(path, node)
      const parts = path.split('/')
      parts.pop()
      let dir = root
      let prefix = ''
      for (const part of parts) {
        prefix = prefix ? `${prefix}/${part}` : part
        let child = dir.children.find((item) => item.type === 'dir' && item.path === prefix)
        if (!child) {
          child = dirNode(part, prefix)
          dir.children.push(child)
        }
        dir = child
      }
      dir.children.push(node)
    }
    if (Number.isInteger(match.line)) {
      node.hits.push({ line: match.line, text: String(match.text || '') })
    }
  }
  sortTree(root.children)
  return root.children
}

// 同一层里目录排在文件前面，各自按名字排。
function sortTree(list) {
  list.sort((a, b) =>
    a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1
  )
  for (const node of list) {
    if (node.type === 'dir') sortTree(node.children)
  }
}

// 摊成带层级的行；收起的目录只留自己那一行，孩子不出现。
export function flattenSearchTree(nodes, collapsed) {
  const closed = collapsed || new Set()
  const rows = []
  const walk = (list, depth) => {
    for (const node of list || []) {
      rows.push({ ...node, depth })
      if (node.type === 'dir' && !closed.has(node.path)) walk(node.children, depth + 1)
    }
  }
  walk(nodes, 0)
  return rows
}
