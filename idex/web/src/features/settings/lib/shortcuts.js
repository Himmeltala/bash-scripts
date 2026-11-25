/*
 * @Author: Himmeltala
 * @Date: 2026-11-25 00:00:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-25 00:00:00
 * @FilePath: \idex\web\src\features\settings\lib\shortcuts.js
 * @Description: 快捷键登记表、按键解析与匹配，设置页和页面处理函数共用一份。
 */

// 绑定写成「Ctrl+Shift+F」这种固定顺序：Ctrl、Shift、Alt、Meta，最后是键名。
export const SHORTCUT_DEFAULTS = {
  save: 'Ctrl+S',
  commit: 'Ctrl+Enter',
  browseSearch: 'Ctrl+F',
  browseContentSearch: 'Ctrl+Shift+F',
  quickOpen: 'Ctrl+P',
  gotoLine: 'Ctrl+G',
  outline: 'Ctrl+Shift+O',
  problems: 'Ctrl+Shift+M',
  hover: 'Ctrl+I',
  editorFind: 'Ctrl+F',
  complete: 'Ctrl+Space',
  format: 'Shift+Alt+F',
  rename: 'F2',
}

export const SHORTCUT_GROUPS = [
  {
    title: '通用',
    scope: 'any',
    items: [
      { id: 'save', title: '保存当前文件' },
      { id: 'commit', title: '提交' },
    ],
  },
  {
    title: '资源管理器',
    scope: 'browse',
    items: [
      {
        id: 'browseSearch',
        title: '按文件名搜索',
        hint: '焦点在资源管理器时生效；代码编辑器里的 Ctrl+F 是查找当前文件。',
      },
      { id: 'browseContentSearch', title: '按内容搜索' },
      { id: 'quickOpen', title: '快速打开' },
      { id: 'gotoLine', title: '转到行' },
      { id: 'outline', title: '符号大纲' },
      { id: 'problems', title: '问题列表' },
      { id: 'hover', title: '悬停提示' },
    ],
  },
  {
    title: '代码编辑器',
    scope: 'editor',
    items: [
      { id: 'editorFind', title: '在文件中查找' },
      { id: 'complete', title: '代码补全' },
      { id: 'format', title: '格式化文档' },
      { id: 'rename', title: '重命名符号' },
    ],
  },
]

export const SHORTCUT_ITEMS = SHORTCUT_GROUPS.flatMap((group) =>
  group.items.map((item) => ({ ...item, group: group.title, scope: group.scope })),
)

const MODIFIER_ORDER = ['Ctrl', 'Shift', 'Alt', 'Meta']
const KEY_ALIASES = {
  ' ': 'Space',
  space: 'Space',
  esc: 'Escape',
  escape: 'Escape',
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  plus: '+',
}

function keyName(key) {
  const raw = String(key || '')
  const lower = raw.toLowerCase()
  if (KEY_ALIASES[lower]) return KEY_ALIASES[lower]
  if (raw.length === 1) return lower
  return raw
}

// 把「Ctrl+Shift+F」拆成修饰键与键名；写坏的返回 null。
export function parseBinding(text) {
  const value = String(text || '').trim()
  if (!value) return null
  const parts = value.split('+').map((part) => part.trim()).filter(Boolean)
  if (!parts.length) return null
  const mods = { ctrl: false, shift: false, alt: false, meta: false }
  for (const part of parts.slice(0, -1)) {
    const lower = part.toLowerCase()
    if (lower === 'ctrl' || lower === 'control') mods.ctrl = true
    else if (lower === 'shift') mods.shift = true
    else if (lower === 'alt' || lower === 'option') mods.alt = true
    else if (lower === 'meta' || lower === 'cmd' || lower === 'command') mods.meta = true
    else return null
  }
  const key = keyName(parts[parts.length - 1])
  if (!key) return null
  return { ...mods, key }
}

// 键盘事件是否正好按下这条绑定；修饰键多按少按都不算。
export function matchesBinding(binding, event) {
  const parsed = parseBinding(binding)
  if (!parsed || !event) return false
  if (
    parsed.ctrl !== !!event.ctrlKey ||
    parsed.shift !== !!event.shiftKey ||
    parsed.alt !== !!event.altKey ||
    parsed.meta !== !!event.metaKey
  ) {
    return false
  }
  return parsed.key === keyName(event.key)
}

// 录制：返回规范写法的绑定；只按了修饰键返回空串。
export function bindingFromEvent(event) {
  if (!event) return ''
  const key = keyName(event.key)
  if (['Control', 'Shift', 'Alt', 'Meta', 'CapsLock'].includes(key)) return ''
  const mods = {
    Ctrl: !!event.ctrlKey,
    Shift: !!event.shiftKey,
    Alt: !!event.altKey,
    Meta: !!event.metaKey,
  }
  const parts = MODIFIER_ORDER.filter((name) => mods[name])
  parts.push(/^[a-z]$/.test(key) ? key.toUpperCase() : key)
  return parts.join('+')
}

// CodeMirror 的 keymap 写法：修饰键用 - 连接，字母小写，Space 这类保留键名。
export function toCmKey(binding) {
  const parsed = parseBinding(binding)
  if (!parsed) return ''
  const parts = []
  if (parsed.ctrl) parts.push('Ctrl')
  if (parsed.shift) parts.push('Shift')
  if (parsed.alt) parts.push('Alt')
  if (parsed.meta) parts.push('Meta')
  parts.push(parsed.key)
  return parts.join('-')
}
