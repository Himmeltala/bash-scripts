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

test('默认绑定覆盖登记表里的每一项，且互不重复', () => {
  const values = Object.values(SHORTCUT_DEFAULTS)
  assert.equal(new Set(values).size, values.length)
  for (const item of SHORTCUT_ITEMS) {
    assert.equal(typeof SHORTCUT_DEFAULTS[item.id], 'string', item.id)
  }
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
