/*
 * @Author: Himmeltala
 * @Date: 2026-11-25 00:00:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-25 00:00:00
 * @FilePath: \idex\web\test\shortcuts.test.js
 * @Description: 快捷键登记表、绑定解析、事件匹配与录制。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SHORTCUT_DEFAULTS,
  SHORTCUT_GROUPS,
  SHORTCUT_ITEMS,
  bindingFromEvent,
  matchesBinding,
  parseBinding,
  toCmKey,
} from '../src/features/settings/lib/shortcuts.js'

const key = (value, mods = {}) => ({
  key: value,
  ctrlKey: !!mods.ctrl,
  shiftKey: !!mods.shift,
  altKey: !!mods.alt,
  metaKey: !!mods.meta,
})

test('默认绑定覆盖登记表里的每一项，同一作用域内不重复', () => {
  const scopes = new Map(SHORTCUT_ITEMS.map((item) => [item.id, item.scope]))
  const seen = new Map()
  for (const item of SHORTCUT_ITEMS) {
    const value = SHORTCUT_DEFAULTS[item.id]
    assert.equal(typeof value, 'string', item.id)
    const scope = scopes.get(item.id)
    const key = `${scope}:${value}`
    assert.equal(seen.has(key), false, `${item.id} 与 ${seen.get(key)} 撞在 ${value}`)
    seen.set(key, item.id)
  }
  const browse = SHORTCUT_GROUPS.find((group) => group.scope === 'browse')
  const editor = SHORTCUT_GROUPS.find((group) => group.scope === 'editor')
  assert.equal(browse.items.some((item) => item.id === 'browseSearch'), true)
  assert.equal(editor.items.some((item) => item.id === 'editorFind'), true)
})

test('解析绑定，修饰键顺序随意，字母不区分大小写', () => {
  assert.deepEqual(parseBinding('Shift+Ctrl+f'), {
    ctrl: true,
    shift: true,
    alt: false,
    meta: false,
    key: 'f',
  })
  assert.equal(parseBinding('Ctrl+Hyper+F'), null)
  assert.equal(parseBinding(''), null)
})

test('匹配要求修饰键与键名完全一致', () => {
  assert.equal(matchesBinding('Ctrl+Shift+F', key('F', { ctrl: true, shift: true })), true)
  assert.equal(matchesBinding('Ctrl+Shift+F', key('F', { ctrl: true })), false)
  assert.equal(matchesBinding('Ctrl+F', key('f', { ctrl: true })), true)
  assert.equal(matchesBinding('Ctrl+Space', key(' ', { ctrl: true })), true)
  assert.equal(matchesBinding('F2', key('F2')), true)
  assert.equal(matchesBinding('', key('F2')), false)
})

test('录制只按修饰键不算，字母输出大写', () => {
  assert.equal(bindingFromEvent(key('Control', { ctrl: true })), '')
  assert.equal(bindingFromEvent(key('f', { ctrl: true, shift: true })), 'Ctrl+Shift+F')
  assert.equal(bindingFromEvent(key(' ', { alt: true })), 'Alt+Space')
})

test('转成 CodeMirror 的 keymap 写法', () => {
  assert.equal(toCmKey('Ctrl+Space'), 'Ctrl-Space')
  assert.equal(toCmKey('Shift+Alt+F'), 'Shift-Alt-f')
  assert.equal(toCmKey('F2'), 'F2')
  assert.equal(toCmKey(''), '')
})
