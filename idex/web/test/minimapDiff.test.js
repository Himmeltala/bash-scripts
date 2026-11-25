/*
 * @Author: Himmeltala
 * @Date: 2026-11-25 00:00:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-25 00:00:00
 * @FilePath: \idex\web\test\minimapDiff.test.js
 * @Description: 代码地图上的差异色条：行号转色块，三类改动各自上色。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { diffGutters } from '../src/features/editor/core/editorBase.js'

test('按行号与改动类型生成一条色带', () => {
  const gutters = diffGutters({
    3: { kind: 'add' },
    5: { kind: 'modify' },
    8: { kind: 'delete' },
    9: { kind: 'unknown' },
  })
  assert.equal(gutters.length, 1)
  assert.deepEqual(gutters[0], { 3: '#3fb950', 5: '#58a6ff', 8: '#f85149' })
})

test('没有标记或行号不合法时不给色带', () => {
  assert.deepEqual(diffGutters(null), [])
  assert.deepEqual(diffGutters({ 0: { kind: 'add' } }), [])
  assert.deepEqual(diffGutters({ 2: { kind: 'same' } }), [])
})
