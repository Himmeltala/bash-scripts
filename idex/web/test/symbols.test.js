/*
 * @Author: Himmeltala
 * @Date: 2026-11-24 16:00:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 16:00:00
 * @FilePath: \idex\web\test\symbols.test.js
 * @Description: 符号图标与服务端动作标题的对照表。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { SYMBOL_ICONS, SYMBOL_TITLES } from '../src/editor/symbols.js'

test('符号图标都是 mdi 图标，服务端动作都有标题', () => {
  for (const icon of Object.values(SYMBOL_ICONS)) {
    assert.equal(icon.startsWith('mdi-'), true, icon)
  }
  for (const action of ['definition', 'typeDefinition', 'implementation', 'references']) {
    assert.equal(typeof SYMBOL_TITLES[action], 'string', action)
  }
})
