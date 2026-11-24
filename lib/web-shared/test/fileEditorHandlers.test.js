/*
 * @Author: Himmeltala
 * @Date: 2026-11-20 00:00:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 16:20:00
 * @FilePath: \lib\web-shared\test\fileEditorHandlers.test.js
 * @Description: 文件类型处理器与通用编辑器插槽的判定。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { handlerOf, modesOf, usesEditorSlot } from '../src/components/commons/FileEditor/handlers/registry.js'

test('代码文件仍走内置处理器', () => {
  assert.equal(handlerOf('a.py').id, 'code')
})

test('Markdown 与未知扩展名仍按原类型分派', () => {
  assert.equal(handlerOf('a.md').id, 'markdown')
  assert.equal(handlerOf('LICENSE').id, 'plain')
  assert.deepEqual(modesOf('a.md').map((mode) => mode.id), ['source', 'render'])
})

test('只有代码文件允许插槽接管', () => {
  assert.equal(usesEditorSlot('a.py', true), true)
  assert.equal(usesEditorSlot('a.py', false), false)
  assert.equal(usesEditorSlot('a.md', true), false)
  assert.equal(usesEditorSlot('LICENSE', true), false)
})
