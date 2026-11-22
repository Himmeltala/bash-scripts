import test from 'node:test'
import assert from 'node:assert/strict'

// 共享 HTTP 客户端在模块加载时取走 fetch，所以先装一层可替换的转发，再动态导入。
let impl = async () => ({ ok: true, json: async () => ({}) })
globalThis.fetch = (...args) => impl(...args)

const { refreshSpend, unpricedModels } = await import('../src/composables/useBudgets.js')

const payload = { rows: [], unpriced_models: ['m1', 'm2'] }

test('请求本月日报并记录无价格模型', async () => {
  unpricedModels.value = []
  let called = 0
  impl = async () => {
    called += 1
    return { ok: true, json: async () => payload }
  }
  await refreshSpend()
  assert.equal(called, 1)
  assert.deepEqual(unpricedModels.value, ['m1', 'm2'])
})

test('请求失败时保留上一次的无价格模型', async () => {
  unpricedModels.value = ['keep']
  impl = async () => {
    throw new Error('offline')
  }
  await refreshSpend()
  assert.deepEqual(unpricedModels.value, ['keep'])
})
