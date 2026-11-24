/*
 * @Author: Himmeltala
 * @Date: 2026-11-20 00:15:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-20 00:15:00
 * @FilePath: \idex\web\test\diagnostics.test.js
 * @Description: 诊断的行号圆点与分类统计。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { markersOf, statsOf } from '../src/editor/diagnostics.js'

test('一行取最重的那一级，error 不被后到的覆盖', () => {
  const markers = markersOf([
    { line: 0, severity: 'warning' },
    { line: 0, severity: 'error' },
    { line: 0, severity: 'info' },
    { line: 2, severity: 'hint' },
  ])
  assert.deepEqual(markers, { 1: 'error', 3: 'info' })
})

test('没有诊断时两个函数都给空结果', () => {
  assert.deepEqual(markersOf([]), {})
  assert.deepEqual(markersOf(null), {})
  assert.deepEqual(statsOf([]), [])
  assert.deepEqual(statsOf(undefined), [])
})

test('分类统计只列真有的级别，按固定顺序', () => {
  const stats = statsOf([
    { severity: 'warning' },
    { severity: 'error' },
    { severity: 'error' },
  ])
  assert.deepEqual(
    stats.map((item) => [item.id, item.count]),
    [
      ['error', 2],
      ['warning', 1],
    ]
  )
})
