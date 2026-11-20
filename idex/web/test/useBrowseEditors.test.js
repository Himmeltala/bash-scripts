/*
 * @Author: Himmeltala
 * @Date: 2026-11-20 01:55:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-20 01:55:00
 * @FilePath: \idex\web\test\useBrowseEditors.test.js
 * @Description: 浏览页页签、草稿与编辑器实例的配合。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { nextTick } from 'vue'
import { useBrowseEditors } from '../src/composables/useBrowseEditors.js'

function fakeEditor(path) {
  return {
    path,
    text: '磁盘内容',
    dirty: false,
    restored: '',
    leave: true,
    async open(name, line) {
      this.path = name
      this.text = '磁盘内容'
      this.line = line || 0
      return true
    },
    async restore(text) {
      this.restored = text
      this.text = text
      this.dirty = true
    },
    async confirmLeave() {
      return this.leave
    },
    async reload() {},
  }
}

function setup() {
  const editors = useBrowseEditors({ kept: null, refreshDiagnostics: () => {} })
  return { ...editors, editorsReady: true }
}

test('打开文件建页签并切换过去，重复打开不重复建', async () => {
  const view = setup()
  const editor = fakeEditor('')
  view.setEditor('a.js', editor)
  await view.show({ path: 'a.js', name: 'a.js', type: 'file', size: 10 })
  await nextTick()
  assert.equal(view.tabs.value.length, 1)
  assert.equal(view.activePath.value, 'a.js')
  assert.equal(view.activeTab.value.path, 'a.js')

  await view.show({ path: 'a.js', name: 'a.js', type: 'file', size: 20 })
  assert.equal(view.tabs.value.length, 1)
  assert.equal(view.tabs.value[0].size, 20)
})

test('草稿取出来再放回去，未保存标记跟着回来', async () => {
  const view = setup()
  const editor = fakeEditor('a.js')
  view.setEditor('a.js', editor)
  await view.show({ path: 'a.js', name: 'a.js', type: 'file' })
  editor.text = '改了一半'
  editor.dirty = true
  view.takeDrafts()
  assert.equal(view.drafts.get('a.js'), '改了一半')

  const fresh = fakeEditor('a.js')
  view.setEditor('a.js', fresh)
  view.restoreDraft('a.js', fresh)
  assert.equal(fresh.restored, '改了一半')
  assert.equal(view.tabs.value[0].dirty, true)
})

test('有未保存草稿时关页签先问，取消就留下', async () => {
  const view = setup()
  const editor = fakeEditor('a.js')
  editor.dirty = true
  editor.leave = false
  view.setEditor('a.js', editor)
  await view.show({ path: 'a.js', name: 'a.js', type: 'file' })
  await view.closeTab(view.tabs.value[0])
  assert.equal(view.tabs.value.length, 1)

  editor.leave = true
  await view.closeTab(view.tabs.value[0])
  assert.equal(view.tabs.value.length, 0)
  assert.equal(view.activePath.value, '')
})
