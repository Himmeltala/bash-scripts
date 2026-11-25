/*
 * @Author: Himmeltala
 * @Date: 2026-11-24 17:00:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 21:41:59
 * @FilePath: \idex\web\src\features\editor\core\forwardEvents.js
 * @Description: CodeMirrorEditor 的事件转发给 BrowsePanel：统一补 path，symbol 改名为 definition。
 */

// 键是 CodeMirrorEditor 的事件，值是 CodeEditorShell 对外的事件名。
export const EDITOR_EVENT_MAP = {
  symbol: 'definition',
  menu: 'menu',
  rename: 'rename',
  caret: 'caret',
  edit: 'edit',
  hover: 'hover',
  'hover-end': 'hover-end',
  diffhunk: 'diffhunk',
}

export function forwardPayload(source, path, payload) {
  // 编辑事件只用来防抖诊断，载荷只需要文件路径。
  if (source === 'edit') return { path }
  return { path, ...(payload || {}) }
}

export function editorForwarders(emit, path) {
  const forwarders = {}
  for (const [source, target] of Object.entries(EDITOR_EVENT_MAP)) {
    forwarders[source] = (payload) => emit(target, forwardPayload(source, path, payload))
  }
  return forwarders
}
