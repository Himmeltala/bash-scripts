/*
 * @Author: Himmeltala
 * @Date: 2026-11-18 22:59:31
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-18 22:59:31
 * @FilePath: \\src\\components\\browse\\browseSessions.js
 * @Description: 按工作区记住浏览页的页签、停的位置与没保存的草稿。
 */

// 换工作区或切到别的页签时面板整个重挂，这里把上次的样子留在内存里，回来接着用。
// 只活在这一次会话里：刷新页面就从空的开始。
const sessions = new Map()

export function sessionOf(id) {
  return (id && sessions.get(id)) || null
}

export function saveSession(id, data) {
  if (id) sessions.set(id, data)
}
