/*
 * @Author: Himmeltala
 * @Date: 2026-11-24 17:00:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 17:00:00
 * @FilePath: \idex\web\test\editorForwarders.test.js
 * @Description: 代码编辑器事件转发：事件名映射与 path 注入。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { editorForwarders } from '../src/editor/forwardEvents.js'

function collect(path, calls) {
  const emit = (name, payload) => calls.push([name, payload])
  return editorForwarders(emit, path)
}

test('symbol 转成 definition，并补上文件路径', () => {
  const calls = []
  const forward = collect('a.js', calls)
  forward.symbol({ word: 'foo', line: 2, character: 3 })
  assert.deepEqual(calls, [
    ['definition', { path: 'a.js', word: 'foo', line: 2, character: 3 }],
  ])
})

test('菜单、重命名、光标、悬停与差异都带 path', () => {
  const calls = []
  const forward = collect('a.js', calls)
  forward.menu({ x: 1, y: 2 })
  forward.rename({ word: 'x' })
  forward.caret({ line: 4, column: 2 })
  forward.hover({ word: 'x', x: 1, y: 2 })
  forward['hover-end']({})
  forward.diffhunk({ hunk: {} })
  assert.deepEqual(calls, [
    ['menu', { path: 'a.js', x: 1, y: 2 }],
    ['rename', { path: 'a.js', word: 'x' }],
    ['caret', { path: 'a.js', line: 4, column: 2 }],
    ['hover', { path: 'a.js', word: 'x', x: 1, y: 2 }],
    ['hover-end', { path: 'a.js' }],
    ['diffhunk', { path: 'a.js', hunk: {} }],
  ])
})

test('edit 没有 payload 时也给出 path，避免解构异常', () => {
  const calls = []
  const forward = collect('a.js', calls)
  forward.edit()
  assert.deepEqual(calls, [['edit', { path: 'a.js' }]])
})
