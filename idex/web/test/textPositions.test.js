/*
 * @Author: Himmeltala
 * @Date: 2026-11-20 00:26:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-20 00:26:00
 * @FilePath: \idex\web\test\textPositions.test.js
 * @Description: 行列与字符偏移的换算。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { offsetOf } from '../src/editor/textPositions.js'

test('第一行第一列是 0，换行占一个字符', () => {
  const text = 'abc\ndefg\nh'
  assert.equal(offsetOf(text, 1, 1), 0)
  assert.equal(offsetOf(text, 1, 3), 2)
  assert.equal(offsetOf(text, 2, 1), 4)
  assert.equal(offsetOf(text, 3, 2), 10)
})

test('列不额外截断，空文本不炸', () => {
  assert.equal(offsetOf('ab\ncd', 1, 99), 98)
  assert.equal(offsetOf('', 1, 1), 0)
  assert.equal(offsetOf(null, 1, 1), 0)
})
