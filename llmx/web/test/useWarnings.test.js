import test from 'node:test'
import assert from 'node:assert/strict'
import { warningRows, warningTone } from '../src/composables/useWarnings.js'

test('无告警时返回空数组与空级别', () => {
  assert.deepEqual(warningRows([], []), [])
  assert.equal(warningTone([]), '')
})

test('无价格模型生成一条警告行', () => {
  const rows = warningRows([], ['m1', 'm2'])
  assert.equal(rows.length, 1)
  assert.equal(rows[0].level, 'warn')
  assert.equal(rows[0].kind, 'unpriced')
  assert.match(rows[0].text, /m1、m2/)
  assert.equal(warningTone(rows), 'warning')
})

test('超支行排在警告行前，级别取最重', () => {
  const rows = warningRows(
    [
      { level: 'warn', text: '每日预算已用 85.0%：¥85.00 / ¥100.00' },
      { level: 'bad', text: '月度预算已超：¥120.00 / ¥100.00' },
    ],
    ['m1'],
  )
  assert.deepEqual(rows.map((row) => row.level), ['bad', 'warn', 'warn'])
  assert.equal(warningTone(rows), 'error')
})
