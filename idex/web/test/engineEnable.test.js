/*
 * @Author: Himmeltala
 * @Date: 2026-11-23 23:09:19
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-23 23:09:19
 * @FilePath: \idex\web\test\engineEnable.test.js
 * @Description: 引擎启用与扫描等待的回归测试。
*/

import test from 'node:test'
import assert from 'node:assert/strict'
import { createEngineEnable } from '../src/components/engines/engineEnable.js'

function setup(overrides = {}) {
  const calls = []
  let registered = false
  let reloads = 0
  const flow = createEngineEnable({
    toolsApi: { rescan: async (id) => calls.push(`tools:${id}`) },
    engineApi: { rescan: async (id) => calls.push(`engine:${id}`) },
    wsId: () => 'w1',
    isRegistered: () => registered,
    reload: async () => {
      reloads += 1
    },
    timeoutText: '超时',
    ...overrides,
  })
  return {
    flow,
    calls,
    reloads: () => reloads,
    setRegistered: (value) => {
      registered = value
    },
  }
}

test('启用先探测能力再让引擎登记', async () => {
  const { flow, calls, reloads } = setup()
  await flow.enable()
  assert.deepEqual(calls, ['tools:w1', 'engine:w1'])
  assert.equal(reloads(), 1)
  assert.equal(flow.enabling.value, false)
  flow.dispose()
})

test('未登记时启用后进入等待，登记后放开', async () => {
  const { flow } = setup()
  await flow.enable()
  assert.equal(flow.waiting.value, true)
  flow.stopWait(true)
  assert.equal(flow.waiting.value, false)
  assert.equal(flow.enableError.value, '')
  flow.dispose()
})

test('已登记时启用不进入等待', async () => {
  const { flow, setRegistered } = setup()
  setRegistered(true)
  await flow.enable()
  assert.equal(flow.waiting.value, false)
  flow.dispose()
})

test('等待超时放开并给出原因', async () => {
  const { flow } = setup({ waitLimit: 10 })
  await flow.enable()
  await new Promise((resolve) => setTimeout(resolve, 25))
  assert.equal(flow.waiting.value, false)
  assert.equal(flow.enableError.value, '超时')
  flow.dispose()
})

test('后台扫描失败由状态接口带回，立即放开等待', async () => {
  const { flow } = setup({
    rescanStatus: async () => ({ running: false, error: '扫描失败：引擎断开' }),
    pollInterval: 5,
  })
  await flow.enable()
  assert.equal(flow.waiting.value, true)
  await new Promise((resolve) => setTimeout(resolve, 30))
  assert.equal(flow.waiting.value, false)
  assert.equal(flow.enableError.value, '扫描失败：引擎断开')
  flow.dispose()
})

test('状态接口没有错误时继续等待', async () => {
  const { flow } = setup({
    rescanStatus: async () => ({ running: true, error: '' }),
    pollInterval: 5,
  })
  await flow.enable()
  await new Promise((resolve) => setTimeout(resolve, 30))
  assert.equal(flow.waiting.value, true)
  assert.equal(flow.enableError.value, '')
  flow.dispose()
})

test('探测回来前换了工作区，不再对旧工作区发引擎重扫', async () => {
  let ws = 'w1'
  const calls = []
  let release
  const flow = createEngineEnable({
    toolsApi: {
      rescan: () =>
        new Promise((resolve) => {
          calls.push('tools:w1')
          release = resolve
        }),
    },
    engineApi: { rescan: async (id) => calls.push(`engine:${id}`) },
    wsId: () => ws,
    isRegistered: () => false,
    reload: async () => {},
    timeoutText: '超时',
  })
  const pending = flow.enable()
  ws = 'w2'
  release()
  await pending
  assert.deepEqual(calls, ['tools:w1'])
  flow.dispose()
})

test('引擎报错留下原因，换工作区把等待与错误清掉', async () => {
  const { flow } = setup({
    engineApi: {
      rescan: async () => {
        throw new Error('503')
      },
    },
  })
  await flow.enable()
  assert.equal(flow.enableError.value, '503')
  assert.equal(flow.enabling.value, false)
  flow.reset()
  assert.equal(flow.enableError.value, '')
  assert.equal(flow.waiting.value, false)
  flow.dispose()
})
