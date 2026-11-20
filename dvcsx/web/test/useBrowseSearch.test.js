/*
 * @Author: Himmeltala
 * @Date: 2026-11-20 02:30:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-20 02:30:00
 * @FilePath: \dvcsx\web\test\useBrowseSearch.test.js
 * @Description: 搜索取数、结果归树与清空。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { nextTick, ref } from 'vue'
import { useBrowseSearch } from '../src/composables/useBrowseSearch.js'

function setup(rows) {
  const calls = []
  const client = {
    search: async (ws, text, mode) => {
      calls.push([ws, text, mode])
      return rows
    },
  }
  const view = useBrowseSearch({ wsId: () => 'w', mode: ref('name'), client })
  return { view, calls }
}

test('搜到结果后按目录归树，清空就收起', async () => {
  const { view, calls } = setup({
    matches: [
      { path: 'src/a.js', name: 'a.js', size: 1, hits: [{ line: 3 }] },
      { path: 'src/b.js', name: 'b.js', size: 2, hits: [{ line: 1 }] },
    ],
    truncated: true,
  })
  view.query.value = 'a'
  await nextTick()
  await view.runSearch()
  assert.deepEqual(calls, [['w', 'a', 'name']])
  assert.equal(view.search.matches.length, 2)
  assert.equal(view.search.truncated, true)
  assert.equal(view.resultRows.value.some((row) => row.type === 'dir'), true)

  view.clearSearch()
  assert.equal(view.query.value, '')
  assert.equal(view.search.matches.length, 0)
  assert.equal(view.searching.value, false)
})

test('空查询不请求，出错时留下错误并清空结果', async () => {
  let calls = 0
  const client = {
    search: async () => {
      calls += 1
      throw new Error('搜索失败')
    },
  }
  const view = useBrowseSearch({ wsId: () => 'w', mode: ref('name'), client })
  await view.runSearch()
  assert.equal(calls, 0)

  view.query.value = 'x'
  await nextTick()
  await view.runSearch()
  assert.equal(calls, 1)
  assert.equal(view.search.error, '搜索失败')
  assert.equal(view.search.matches.length, 0)
  assert.equal(view.search.loading, false)
})

test('点目录行收起再展开', async () => {
  const { view } = setup({
    matches: [{ path: 'src/a.js', name: 'a.js', size: 1, hits: [] }],
    truncated: false,
  })
  view.query.value = 'a'
  await nextTick()
  await view.runSearch()
  const dir = view.resultRows.value.find((row) => row.type === 'dir')
  assert.equal(view.collapsedDirs.value.has(dir.path), false)
  view.toggleResultDir(dir.path)
  assert.equal(view.collapsedDirs.value.has(dir.path), true)
  view.toggleResultDir(dir.path)
  assert.equal(view.collapsedDirs.value.has(dir.path), false)
})
