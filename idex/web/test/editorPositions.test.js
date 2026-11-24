import test from 'node:test'
import assert from 'node:assert/strict'
import { offsetAt } from '../src/features/editor/core/positions.js'

test('行列换算成文档偏移', () => {
  assert.equal(offsetAt('ab\ncd', 1, 1), 4)
})

test('列越界夹到行尾', () => {
  assert.equal(offsetAt('ab\ncd', 1, 99), 5)
})

test('emoji 按两个 UTF-16 码元计算', () => {
  assert.equal(offsetAt('a😀b\ncd', 0, 4), 4)
})

test('行尾的 \\r 不吞掉', () => {
  assert.equal(offsetAt('a\r\nb', 1, 0), 3)
})

test('行越界夹到文档末尾', () => {
  assert.equal(offsetAt('ab\ncd', 99, 0), 5)
})
