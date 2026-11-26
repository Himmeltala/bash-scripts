/*
 * @Author: Himmeltala
 * @Date: 2026-11-26 09:26:41
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-26 09:26:41
 * @FilePath: \idex\web\test\capabilities.test.js
 * @Description: 语言服务器能力文案的测试。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { capabilityText } from '../src/features/engines/lib/capabilities.js'

test('Vue 接上补全与格式化后按能力说明', () => {
  assert.equal(
    capabilityText({ id: 'vue', capabilities: { completion: true, formatting: true } }),
    '支持补全；支持格式化',
  )
})

test('其他服务器按能力拼说明', () => {
  assert.equal(
    capabilityText({ id: 'python', capabilities: { completion: true, formatting: false } }),
    '支持补全；不支持格式化',
  )
  assert.equal(
    capabilityText({ id: 'typescript', capabilities: { completion: true, formatting: true } }),
    '支持补全；支持格式化',
  )
  assert.equal(capabilityText({ id: 'plain' }), '')
})
