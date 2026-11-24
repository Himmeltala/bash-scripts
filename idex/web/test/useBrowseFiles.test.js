/*
 * @Author: Himmeltala
 * @Date: 2026-11-20 02:10:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-20 02:10:00
 * @FilePath: \idex\web\test\useBrowseFiles.test.js
 * @Description: 浏览页新建、改名、删除的弹窗状态。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { ref } from 'vue'
import { useBrowseFiles } from '../src/components/browse/useBrowseFiles.js'

function setup() {
  return useBrowseFiles({
    wsId: () => 'w',
    tabs: ref([]),
    activePath: ref(''),
    drafts: new Map(),
    editorOf: () => null,
    show: async () => {},
    reveal: async () => {},
    reload: async () => {},
  })
}

test('右键新建打开对应弹窗，目录取节点的路径', () => {
  const view = setup()
  view.onTreeAction({ action: 'create-file', node: { path: 'src', type: 'dir' } })
  assert.equal(view.nameAsk.on, true)
  assert.equal(view.nameAsk.mode, 'file')
  assert.equal(view.nameAsk.dir, 'src')
  assert.equal(view.nameTitle.value, '新建文件')
  // 节点是目录，标签按目录给（沿用原来的判定）。
  assert.equal(view.nameLabel.value, '目录名')

  view.onTreeAction({ action: 'create-dir', node: { path: 'src', type: 'dir' } })
  assert.equal(view.nameAsk.mode, 'dir')
  assert.equal(view.nameTitle.value, '新建目录')
  assert.equal(view.nameLabel.value, '目录名')
})

test('改名带出原名字，目录名按节点类型判断', () => {
  const view = setup()
  view.onTreeAction({ action: 'rename', node: { path: 'src/a.js', name: 'a.js', type: 'file' } })
  assert.equal(view.nameAsk.mode, 'rename')
  assert.equal(view.nameAsk.dir, 'src')
  assert.equal(view.nameAsk.value, 'a.js')
  assert.equal(view.nameLabel.value, '文件名')

  view.onTreeAction({ action: 'rename', node: { path: 'src/lib', name: 'lib', type: 'dir' } })
  assert.equal(view.nameTitle.value, '重命名')
  assert.equal(view.nameLabel.value, '目录名')
})

test('删除打开确认框', () => {
  const view = setup()
  const node = { path: 'a.js', type: 'file' }
  view.onTreeAction({ action: 'delete', node })
  assert.equal(view.delAsk.on, true)
  assert.equal(view.delAsk.node.path, 'a.js')
})

test('空名字与带分隔符的名字拦在接口前面', async () => {
  const view = setup()
  view.onTreeAction({ action: 'create-file', node: { path: '', type: 'dir' } })
  view.nameAsk.value = '   '
  await view.submitName()
  assert.equal(view.nameAsk.error, '名字不能为空')
  view.nameAsk.value = 'a/b'
  await view.submitName()
  assert.equal(view.nameAsk.error, '名字里不能带路径分隔符')
})
