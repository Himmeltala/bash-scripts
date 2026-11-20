/*
 * @Author: Himmeltala
 * @Date: 2026-11-20 00:26:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-20 00:26:00
 * @FilePath: \dvcsx\web\test\languageServers.test.js
 * @Description: 语言、服务器与符号图标对照表的一致性。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  LANGUAGES,
  SERVER_BY_EXT,
  SYMBOL_ICONS,
  SYMBOL_TITLES,
} from '../src/utils/languageServers.js'

test('挂服务器的扩展名都有语言名', () => {
  for (const ext of Object.keys(SERVER_BY_EXT)) {
    assert.equal(typeof LANGUAGES[ext], 'string', ext)
  }
})

test('服务器 id 都在约定的五个里', () => {
  const known = new Set(['shell', 'python', 'typescript', 'vue', 'java'])
  for (const id of Object.values(SERVER_BY_EXT)) {
    assert.equal(known.has(id), true, id)
  }
})

test('符号图标都是 mdi 图标，服务端动作都有标题', () => {
  for (const icon of Object.values(SYMBOL_ICONS)) {
    assert.equal(icon.startsWith('mdi-'), true, icon)
  }
  for (const action of ['definition', 'typeDefinition', 'implementation', 'references']) {
    assert.equal(typeof SYMBOL_TITLES[action], 'string', action)
  }
})
