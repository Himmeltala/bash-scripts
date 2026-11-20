/*
 * @Author: Himmeltala
 * @Date: 2026-11-20 02:45:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-20 02:45:00
 * @FilePath: \idex\web\test\useCodeIndex.test.js
 * @Description: 代码索引的定义查询、状态栏、重命名与悬停缓存。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { reactive, ref } from 'vue'
import { useCodeIndex } from '../src/composables/useCodeIndex.js'

function fakeEditor(path = 'a.js') {
  return {
    path,
    text: 'const foo = 1',
    dirty: false,
    reloaded: 0,
    async reload() {
      this.reloaded += 1
    },
    async confirmLeave() {
      return true
    },
  }
}

function setup(client = {}, editors = {}) {
  const opened = []
  const flashes = []
  const reloaded = []
  const view = useCodeIndex({
    wsId: () => 'w',
    activePath: ref('a.js'),
    activeTab: ref({ path: 'a.js' }),
    editorOf: (path) => editors[path] || null,
    caret: reactive({ line: 1, column: 7 }),
    openLocation: (loc) => opened.push(loc),
    reloadDir: (path) => reloaded.push(path),
    flash: (text) => flashes.push(text),
    client,
  })
  return { view, opened, flashes, reloaded }
}

test('一条定义直接跳，多条列候选，零条给提示', async () => {
  const editor = fakeEditor()
  let locations = [{ path: 'a.js', line: 0, character: 4 }]
  const { view, opened, flashes } = setup(
    {
      definition: async () => ({ locations }),
    },
    { 'a.js': editor }
  )

  await view.onDefinition({ path: 'a.js', line: 0, character: 6, word: 'foo' })
  assert.deepEqual(opened, [{ path: 'a.js', line: 0, character: 4 }])
  assert.equal(view.defAsk.on, false)

  locations = [
    { path: 'a.js', line: 0, character: 4 },
    { path: 'b.js', line: 2, character: 0 },
  ]
  await view.onDefinition({ path: 'a.js', line: 0, character: 6, word: 'foo' })
  assert.equal(view.defAsk.on, true)
  assert.equal(view.defAsk.word, 'foo')
  assert.equal(view.defAsk.list.length, 2)

  locations = []
  await view.onDefinition({ path: 'a.js', line: 0, character: 6, word: 'foo' })
  assert.equal(flashes.at(-1), '没找到「foo」的定义')
})

test('右键的动作走 query，标题按动作给', async () => {
  const editor = fakeEditor()
  let action = ''
  const { view, opened } = setup(
    {
      query: async (ws, path, text, line, character, name) => {
        action = name
        return { locations: [{ path: 'a.js', line: 1, character: 0 }] }
      },
    },
    { 'a.js': editor }
  )
  await view.askLocations('references', { path: 'a.js', line: 0, character: 6, word: 'foo' })
  assert.equal(action, 'references')
  assert.deepEqual(opened, [{ path: 'a.js', line: 1, character: 0 }])
})

test('状态栏按扩展名找服务器，语言名跟着文件走', async () => {
  const { view } = setup({
    lspStatus: async () => ({
      servers: [{ id: 'typescript', title: 'TS', command: 'tsserver', available: true, hint: '' }],
    }),
  })
  await view.loadServers()
  assert.equal(view.serverReady.value, true)
  assert.equal(view.languageLabel.value, 'JavaScript')
  assert.equal(view.serverLabel.value, 'TS 索引就绪')
})

test('重命名先预览再落盘，开着同一文件时重读', async () => {
  const editor = fakeEditor()
  const { view, reloaded, flashes } = setup(
    {
      renamePreview: async () => ({ files: [{ path: 'a.js' }], total: 2 }),
      renameApply: async () => ({ files: [{ path: 'a.js' }], total: 2 }),
    },
    { 'a.js': editor }
  )
  view.openRename({ path: 'a.js', line: 0, character: 6, word: 'foo' })
  view.renameAsk.value = 'bar'
  await view.previewRename()
  assert.equal(view.renameAsk.step, 'preview')
  assert.equal(view.renameAsk.total, 2)

  await view.applyRename()
  assert.equal(editor.reloaded, 1)
  assert.deepEqual(reloaded, ['a.js'])
  assert.equal(view.renameAsk.on, false)
  assert.equal(flashes.at(-1), '已重命名「foo」，改了 2 处')
})

test('有草稿的文件挡住重命名，不去改盘', async () => {
  const editor = fakeEditor()
  editor.dirty = true
  let applied = 0
  const { view } = setup(
    {
      renamePreview: async () => ({ files: [{ path: 'a.js' }], total: 1 }),
      renameApply: async () => {
        applied += 1
        return { files: [], total: 0 }
      },
    },
    { 'a.js': editor }
  )
  view.openRename({ path: 'a.js', line: 0, character: 6, word: 'foo' })
  view.renameAsk.files = [{ path: 'a.js' }]
  await view.applyRename()
  assert.equal(applied, 0)
  assert.equal(view.renameAsk.error.includes('先保存'), true)
})

test('同一位置的悬停只问一次', async () => {
  const saved = globalThis.window
  globalThis.window = { innerWidth: 1200, innerHeight: 800 }
  let calls = 0
  try {
    const editor = fakeEditor()
    const { view } = setup(
      {
        lspStatus: async () => ({
          servers: [{ id: 'typescript', available: true, title: 'TS', command: 'x', hint: '' }],
        }),
        hover: async () => {
          calls += 1
          return { hover: { text: 'foo: number' } }
        },
      },
      { 'a.js': editor }
    )
    await view.loadServers()
    view.onHover({ path: 'a.js', line: 0, character: 6, x: 40, y: 40 })
    await new Promise((resolve) => setTimeout(resolve, 0))
    assert.equal(view.hoverTip.on, true)
    assert.equal(view.hoverTip.text, 'foo: number')

    view.onHover({ path: 'a.js', line: 0, character: 6, x: 60, y: 60 })
    assert.equal(calls, 1)
    assert.equal(view.hoverTip.text, 'foo: number')
  } finally {
    globalThis.window = saved
  }
})
