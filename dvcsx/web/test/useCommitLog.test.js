/*
 * @Author: Himmeltala
 * @Date: 2026-11-20 02:35:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-20 02:35:00
 * @FilePath: \dvcsx\web\test\useCommitLog.test.js
 * @Description: 提交日志的首屏、选中、差异与加载更多。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { ref } from 'vue'
import { useCommitLog } from '../src/composables/useCommitLog.js'

function entry(revision, paths = []) {
  return { revision, paths, message: `${revision} 说明`, date: '', local: true, pushed: true }
}

function setup(client) {
  return useCommitLog({
    wsId: () => 'w',
    refresh: () => 0,
    allBranches: ref(true),
    diffScope: ref('file'),
    isGit: () => true,
    autoStart: false,
    client,
  })
}

test('首屏加载后选中第一条，取说明与差异', async () => {
  const calls = { log: 0, commit: 0, revision: 0 }
  const client = {
    log: async (ws, page, skip, sync, all) => {
      calls.log += 1
      return { entries: [entry('r1', [{ path: 'a.js', name: 'a.js', action: 'M' }]), entry('r2')], remote: { branch: 'main' } }
    },
    commit: async () => {
      calls.commit += 1
      return { paths: [{ path: 'a.js', name: 'a.js' }], message: '完整说明' }
    },
    revision: async () => {
      calls.revision += 1
      return { text: 'diff 内容', truncated: false }
    },
  }
  const view = setup(client)
  await view.load()
  assert.equal(calls.log >= 1, true)
  assert.equal(view.entries.value.length, 2)
  assert.equal(view.current.value.revision, 'r1')
  assert.equal(view.activePath.value, 'a.js')
  assert.equal(view.content.value.text, 'diff 内容')
  assert.equal(calls.revision, 1)
})

test('锁文件的差异默认不请求，点了加载才取', async () => {
  let revisions = 0
  const client = {
    log: async () => ({
      entries: [entry('r1', [{ path: 'package-lock.json', name: 'package-lock.json', action: 'M' }])],
      remote: null,
    }),
    commit: async () => ({ paths: [], message: '' }),
    revision: async (...args) => {
      revisions += 1
      return { text: 'diff', truncated: false }
    },
  }
  const view = setup(client)
  await view.load()
  assert.equal(view.activePath.value, 'package-lock.json')
  assert.equal(revisions, 0)
  assert.equal(view.awaitingLoad.value, true)

  view.showDeferred()
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(revisions, 1)
})

test('加载更多去重，翻完一页就标记到底', async () => {
  const client = {
    log: async (ws, page, skip) => ({
      entries: skip ? [entry('r1'), entry('r3')] : [entry('r1')],
      remote: null,
    }),
    commit: async () => ({ paths: [], message: '' }),
    revision: async () => ({ text: '', truncated: false }),
  }
  const view = setup(client)
  await view.load()
  assert.equal(view.entries.value.length, 1)
  assert.equal(view.exhausted.value, true)

  // 首屏不足一页即到底，不再请求第二页。
  await view.more()
  assert.equal(view.entries.value.length, 1)
})
