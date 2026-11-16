// 左侧分组结构的纯逻辑：平铺成行、列出可选分组、判断层级关系。
// 节点表是一张平铺的数组，同一父级下的先后按数组位置；父级为空表示最外层。

const ROOT = ''

// 父级指向不存在或指向自己的，一律挂回最外层。
function parentOf(node, groupIds) {
  const parent = String(node.parent || '').trim()
  return parent && groupIds.has(parent) ? parent : ROOT
}

// 平铺成一行一条，缩进按层级算；折叠的分组不带出子节点。
export function flattenRows(groups, workspaces, collapsed) {
  const byId = new Map(workspaces.map((ws) => [ws.id, ws]))
  const groupIds = new Set()
  for (const node of groups) {
    if (node && node.kind === 'group' && node.id) groupIds.add(node.id)
  }

  const byParent = new Map()
  const placed = new Set()
  const seenGroups = new Set()
  const groupNodes = []
  const groupById = new Map()
  const push = (parent, node) => {
    if (!byParent.has(parent)) byParent.set(parent, [])
    byParent.get(parent).push(node)
  }
  for (const node of groups) {
    if (!node || !node.id) continue
    if (node.kind === 'ws') {
      if (!byId.has(node.id) || placed.has(node.id)) continue
      placed.add(node.id)
      push(parentOf(node, groupIds), node)
    } else if (node.kind === 'group' && node.name) {
      if (seenGroups.has(node.id)) continue
      seenGroups.add(node.id)
      groupNodes.push(node)
      groupById.set(node.id, node)
      push(parentOf(node, groupIds), node)
    }
  }

  // 顺着父级能不能走到最外层；走不到就是成环，得兜底列出来。
  const reachesRoot = (node) => {
    let cur = node
    const seen = new Set()
    while (cur) {
      if (seen.has(cur.id)) return false
      seen.add(cur.id)
      const parent = parentOf(cur, groupIds)
      if (!parent) return true
      cur = groupById.get(parent)
    }
    return true
  }

  const out = []
  const walked = new Set()
  const walk = (parent, depth) => {
    for (const node of byParent.get(parent) || []) {
      if (node.kind === 'ws') {
        out.push({ key: `ws:${node.id}`, kind: 'ws', id: node.id, depth, parent, ws: byId.get(node.id) })
        continue
      }
      if (walked.has(node.id)) continue
      walked.add(node.id)
      out.push({ key: `group:${node.id}`, kind: 'group', id: node.id, depth, parent, name: node.name, group: node })
      if (!collapsed.has(node.id)) walk(node.id, depth + 1)
    }
  }
  walk(ROOT, 0)
  // 成环导致从最外层走不到的分组，兜底当一级分组列出来；只是被折叠盖住的不算。
  for (const node of groupNodes) {
    if (walked.has(node.id) || reachesRoot(node)) continue
    walked.add(node.id)
    out.push({
      key: `group:${node.id}`,
      kind: 'group',
      id: node.id,
      depth: 0,
      parent: ROOT,
      name: node.name,
      group: node,
    })
    if (!collapsed.has(node.id)) walk(node.id, 1)
  }
  // 没排过的工作区（刚加的那个）挂到最外层末尾。
  for (const ws of workspaces) {
    if (placed.has(ws.id)) continue
    out.push({ key: `ws:${ws.id}`, kind: 'ws', id: ws.id, depth: 0, parent: ROOT, ws })
  }
  return out
}

// 右键菜单里的分组清单：按层级列出来，环与孤儿同样兜底。
export function listGroups(groups) {
  const byParent = new Map()
  const seen = new Set()
  const out = []
  for (const node of groups) {
    if (!node || node.kind !== 'group' || !node.id || !node.name || seen.has(node.id)) continue
    seen.add(node.id)
    const parent = String(node.parent || '').trim()
    if (!byParent.has(parent)) byParent.set(parent, [])
    byParent.get(parent).push(node)
  }
  const placed = new Set()
  const walk = (parent, depth) => {
    for (const node of byParent.get(parent) || []) {
      if (placed.has(node.id)) continue
      placed.add(node.id)
      out.push({ id: node.id, name: node.name, depth })
      walk(node.id, depth + 1)
    }
  }
  walk(ROOT, 0)
  for (const list of byParent.values()) {
    for (const node of list) {
      if (placed.has(node.id)) continue
      placed.add(node.id)
      out.push({ id: node.id, name: node.name, depth: 0 })
    }
  }
  return out
}

// groupId 在不在 rootId 的子树里（含自身）；用来拦住把分组拖进自己的子孙。
export function inSubtree(groups, rootId, groupId) {
  let cur = String(groupId || '')
  const seen = new Set()
  while (cur && !seen.has(cur)) {
    if (cur === rootId) return true
    seen.add(cur)
    const node = groups.find((n) => n && n.kind === 'group' && n.id === cur)
    cur = node ? String(node.parent || '') : ''
  }
  return false
}

// 改结构之前先补成一张完整的表：没登记的工作区补到最外层，已经移出的丢掉。
export function fullNodes(groups, workspaces) {
  const live = new Set(workspaces.map((ws) => ws.id))
  const seen = new Set()
  const nodes = []
  for (const node of groups) {
    if (!node || (node.kind !== 'group' && node.kind !== 'ws')) continue
    if (!node.id || (node.kind === 'ws' && !live.has(node.id))) continue
    const key = `${node.kind}:${node.id}`
    if (seen.has(key)) continue
    seen.add(key)
    nodes.push({ ...node, parent: node.parent || '' })
  }
  for (const ws of workspaces) {
    if (!seen.has(`ws:${ws.id}`)) nodes.push({ kind: 'ws', id: ws.id, parent: '' })
  }
  return nodes
}
