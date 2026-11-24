import test from 'node:test'
import assert from 'node:assert/strict'
import { fadeColor } from '../src/views/usage/lib/chartUtils.js'

test('十六进制颜色按透明度转 rgba', () => {
  assert.equal(fadeColor('#112233', 0.5), 'rgba(17,34,51,0.5)')
  assert.equal(fadeColor('#abc', 0), 'rgba(170,187,204,0)')
})

test('非十六进制颜色原样返回', () => {
  assert.equal(fadeColor('rgb(1,2,3)', 0.3), 'rgb(1,2,3)')
  assert.equal(fadeColor('', 0.3), '')
  assert.equal(fadeColor('#xyz', 0.3), '#xyz')
})
