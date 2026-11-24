/*
 * @Author: Himmeltala
 * @Date: 2026-11-23 23:09:19
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-23 23:09:19
 * @FilePath: \idex\web\test\toolApi.test.js
 * @Description: 引擎接口表的回归测试。
*/

import test from 'node:test'
import assert from 'node:assert/strict'

// createJsonClient 在模块加载时取全局 fetch，所以先换掉再动态导入。
const calls = []
globalThis.fetch = async (url, options = {}) => {
  calls.push({ url, method: options.method || 'GET', body: options.body })
  return { ok: true, status: 200, json: async () => ({ ok: true }) }
}

const { toolApi, nodeApi, jvmApi, toolsApi } = await import('../src/components/engines/toolApi.js')

function reset() {
  calls.length = 0
}

test('tools 前缀走公共接口表', async () => {
  reset()
  const api = toolApi('/__idex/api/tools')
  await api.state()
  await api.rescan('w1')
  assert.deepEqual(calls, [
    { url: '/__idex/api/tools/state', method: 'GET', body: undefined },
    { url: '/__idex/api/tools/rescan', method: 'POST', body: JSON.stringify({ ws: 'w1' }) },
  ])
})

test('nodeApi 的独有路由挂在 node 前缀下', async () => {
  reset()
  await nodeApi.nodes()
  await nodeApi.rescanStatus('w1')
  await nodeApi.setNode('w1', '/opt/node')
  await nodeApi.addCommand({ ws: 'w1', type: 'dev', tag: 'mock', args: 'npm run mock' })
  await nodeApi.removeCommand('s1')
  assert.deepEqual(calls.map((item) => [item.method, item.url]), [
    ['GET', '/__idex/api/node/nodes'],
    ['GET', '/__idex/api/node/rescan/status?ws=w1'],
    ['POST', '/__idex/api/node/node'],
    ['POST', '/__idex/api/node/addcmd'],
    ['POST', '/__idex/api/node/delcmd'],
  ])
  assert.equal(calls[2].body, JSON.stringify({ ws: 'w1', node: '/opt/node' }))
})

test('jvmApi 的独有路由挂在 jvm 前缀下', async () => {
  reset()
  await jvmApi.jdks()
  await jvmApi.rescanStatus('w1')
  await jvmApi.setJdk('w1', '/opt/jdk')
  await jvmApi.restart('r1')
  assert.deepEqual(calls.map((item) => [item.method, item.url]), [
    ['GET', '/__idex/api/jvm/jdks'],
    ['GET', '/__idex/api/jvm/rescan/status?ws=w1'],
    ['POST', '/__idex/api/jvm/jdk'],
    ['POST', '/__idex/api/jvm/restart'],
  ])
  assert.equal(calls[3].body, JSON.stringify({ run: 'r1' }))
})

test('推送地址与接口前缀一致', () => {
  assert.equal(toolsApi.stateStreamUrl(), '/__idex/api/tools/state/stream')
  assert.equal(nodeApi.logStreamUrl('r1'), '/__idex/api/node/log/stream?run=r1')
  assert.equal(jvmApi.stateStreamUrl(), '/__idex/api/jvm/state/stream')
})
