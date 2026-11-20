/*
 * @Author: Himmeltala
 * @Date: 2026-11-20 02:40:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-20 02:40:00
 * @FilePath: \dvcsx\web\test\useSyncJob.test.js
 * @Description: 同步任务的启动、输出流、收尾与取消。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { useSyncJob } from '../src/composables/useSyncJob.js'

class FakeStream {
  constructor(url) {
    this.url = url
    this.listeners = {}
    this.closed = false
    FakeStream.last = this
  }

  addEventListener(type, fn) {
    if (!this.listeners[type]) this.listeners[type] = []
    this.listeners[type].push(fn)
  }

  emit(type, payload) {
    for (const fn of this.listeners[type] || []) fn({ data: JSON.stringify(payload) })
  }

  close() {
    this.closed = true
  }
}

function setup({ start, latest, cancel, body = {} } = {}) {
  const calls = { start: [], cancel: [], finished: [] }
  const client = {
    startOperation: async (payload) => {
      calls.start.push(payload)
      return start ? start(payload) : { id: 'j1', command: 'git pull' }
    },
    latestOperation: async () => ({ job: latest || null }),
    cancelOperation: async (id) => {
      calls.cancel.push(id)
      return { ok: true }
    },
    job: async () => ({ done: true, ok: true }),
    ...(cancel ? { cancelOperation: cancel } : {}),
  }
  const view = useSyncJob({
    wsId: () => 'w',
    bodyFor: () => body,
    onFinish: (action, data) => calls.finished.push([action, data]),
    client,
    openStream: (url) => new FakeStream(url),
  })
  return { view, calls }
}

test('启动任务后接上输出流，收尾通知页面', async () => {
  const { view, calls } = setup({ body: { mode: 'ff' } })
  assert.equal(await view.start('pull'), true)
  assert.deepEqual(calls.start, [{ ws: 'w', action: 'pull', mode: 'ff' }])
  assert.equal(view.running.value, 'pull')
  assert.equal(view.output.value.startsWith('$ git pull'), true)

  FakeStream.last.emit('output', { line: 'Already up to date.' })
  assert.equal(view.output.value.includes('Already up to date.'), true)

  FakeStream.last.emit('done', { ok: true })
  assert.equal(view.running.value, '')
  assert.equal(view.jobId.value, '')
  assert.equal(FakeStream.last.closed, true)
  assert.deepEqual(calls.finished, [['pull', { ok: true }]])
})

test('任务失败时留下错误信息，取消调用对应接口', async () => {
  const { view, calls } = setup({ start: () => ({ id: 'j2', command: 'git commit' }) })
  await view.start('commit')
  FakeStream.last.emit('done', { ok: false, error: '认证失败' })
  assert.equal(view.lastError.value, '认证失败')
  assert.equal(view.running.value, '')

  await view.start('commit')
  await view.cancel()
  assert.deepEqual(calls.cancel, ['j2'])
})

test('打开页面时接回还在跑的任务', async () => {
  const { view } = setup({
    latest: { id: 'j9', action: 'push', command: 'git push', done: false },
  })
  await view.attachRunningJob()
  assert.equal(view.running.value, 'push')
  assert.equal(view.output.value.startsWith('$ git push'), true)
  assert.equal(FakeStream.last.url.includes('j9'), true)
})
