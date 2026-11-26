/*
 * @Author: Himmeltala
 * @Date: 2026-11-26 10:20:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-26 10:20:00
 * @FilePath: \idex\web\src\features\terminal\lib\groups.js
 * @Description: 终端按工作区分组：组名、组数量与 Dock 当前查看组的回落规则。
 */

// 工作区显示名：有别名用别名，否则用目录名。
export function displayName(ws) {
  if (!ws) return ''
  if (ws.alias) return ws.alias
  const parts = String(ws.root || '').split('/').filter(Boolean)
  return parts[parts.length - 1] || String(ws.root || '')
}

// 只列有终端的工作区组，顺序跟工作区列表一致。
export function groupRows(groups, workspaces) {
  const rows = []
  for (const ws of workspaces || []) {
    const found = groups?.[ws.id]
    const count = found?.items?.length || 0
    if (!count) continue
    rows.push({ wsId: ws.id, name: displayName(ws), count })
  }
  return rows
}

// Dock 当前该显示哪一组：查看组还有终端就用它，否则回到当前工作区。
export function resolveView(viewWsId, currentId, groups) {
  const found = viewWsId ? groups?.[viewWsId] : null
  if (found?.items?.length) return viewWsId
  return currentId || ''
}
