/*
 * @Author: Himmeltala
 * @Date: 2026-11-20 00:00:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-20 00:00:00
 * @FilePath: \idex\web\test\browseMenus.test.js
 * @Description: 浏览页菜单与快捷键登记表的结构约束。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { SHORTCUTS, SYMBOL_MENU, TAB_MENU } from '../src/utils/browseMenus.js'

const actions = (menu) => menu.filter((item) => !item.sep).map((item) => item.action)

test('标签页菜单的动作不重复，且都被处理函数接住', () => {
  const list = actions(TAB_MENU)
  assert.deepEqual(new Set(list).size, list.length)
  for (const action of list) {
    assert.equal(['close', 'others', 'all', 'copy', 'copy-abs'].includes(action), true, action)
  }
})

test('代码菜单的动作不重复，且都归在本地动作或服务端动作里', () => {
  const local = ['copy', 'rename', 'hover']
  const server = ['definition', 'typeDefinition', 'implementation', 'references']
  const list = actions(SYMBOL_MENU)
  assert.deepEqual(new Set(list).size, list.length)
  for (const action of list) {
    assert.equal(local.includes(action) || server.includes(action), true, action)
  }
})

test('快捷键不重复，同一个键的 Shift 组合能分开', () => {
  const seen = new Set()
  for (const item of SHORTCUTS) {
    const key = `${item.key}:${item.shift ? 'shift' : 'plain'}`
    assert.equal(seen.has(key), false, key)
    seen.add(key)
  }
  assert.equal(['quick-open', 'goto-line', 'outline', 'hover'].includes(SHORTCUTS[0].action), true)
})

test('菜单项都有文字与图标', () => {
  for (const item of [...TAB_MENU, ...SYMBOL_MENU]) {
    if (item.sep) continue
    assert.equal(typeof item.label, 'string')
    assert.equal(item.label.length > 0, true)
    assert.equal(String(item.icon || '').startsWith('mdi-'), true, item.action)
  }
})
