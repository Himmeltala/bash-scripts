import test from 'node:test'
import assert from 'node:assert/strict'
import { capabilityText } from '../src/utils/capabilities.js'

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
