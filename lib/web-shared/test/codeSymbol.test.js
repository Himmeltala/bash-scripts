/*
 * @Author: Himmeltala
 * @Date: 2026-11-18 23:42:17
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-18 23:42:17
 * @FilePath: \lib\web-shared\test\codeSymbol.test.js
 * @Description: 光标处取标识符与行列的边界用例。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { symbolAt } from '../src/utils/commons/codeSymbol.js'

test('点在标识符中间取整段，行列从 0 起', () => {
  const text = 'const value = compute()\n'
  assert.deepEqual(symbolAt(text, text.indexOf('value') + 2), {
    word: 'value',
    line: 0,
    character: 6,
  })
  assert.deepEqual(symbolAt(text, text.indexOf('compute') + 1), {
    word: 'compute',
    line: 0,
    character: 14,
  })
})

test('点在词尾空白处往左收一个字', () => {
  const text = 'alpha beta'
  assert.deepEqual(symbolAt(text, 5), { word: 'alpha', line: 0, character: 0 })
})

test('点在标点上取不到', () => {
  assert.equal(symbolAt('a, b', 1), null)
  assert.equal(symbolAt('', 0), null)
  assert.equal(symbolAt('a', 5), null)
  assert.equal(symbolAt('a', -1), null)
})

test('跨行按新行算，中文与 emoji 按 UTF-16 列', () => {
  const text = '第一行\n名字 = 1\n😀 foo'
  const name = text.indexOf('名字')
  assert.deepEqual(symbolAt(text, name + 1), { word: '名字', line: 1, character: 0 })
  const foo = text.indexOf('foo')
  // emoji 占两个 UTF-16 单元，foo 从第 3 列开始。
  assert.deepEqual(symbolAt(text, foo), { word: 'foo', line: 2, character: 3 })
})

test('$ 与 @ 也算标识符', () => {
  assert.deepEqual(symbolAt('$HOME @scope', 1), { word: '$HOME', line: 0, character: 0 })
  assert.deepEqual(symbolAt('@scope/pkg', 2), { word: '@scope', line: 0, character: 0 })
})
