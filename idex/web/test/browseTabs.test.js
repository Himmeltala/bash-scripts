/*
 * @Author: Himmeltala
 * @Date: 2026-11-26 09:26:41
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-26 09:26:41
 * @FilePath: \idex\web\test\browseTabs.test.js
 * @Description: 浏览页页签操作的测试。
 */
// 浏览页的页签摆布：打开、关闭后停在哪个，以及改名后路径怎么跟。
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  closeTab,
  followMoved,
  openTab,
  renameTabs,
  tabOf,
  updateTab,
} from '../src/features/browse/lib/browseTabs.js'

const a = { path: 'a.md', name: 'a.md', type: 'file', size: 10, dirty: false }
const b = { path: 'dir/b.js', name: 'b.js', type: 'file', size: 20, dirty: false }
const c = { path: 'dir/c.js', name: 'c.js', type: 'file', size: 30, dirty: false }

test('打开新文件加到最右边，重复打开复用同一个', () => {
  let tabs = openTab([], a)
  tabs = openTab(tabs, b)
  assert.deepEqual(
    tabs.map((tab) => tab.path),
    ['a.md', 'dir/b.js']
  )
  assert.equal(tabs[0].dirty, false)
  assert.equal(openTab(tabs, { ...a }) === tabs, true)
})

test('复用页签时大小跟着目录树更新', () => {
  const tabs = openTab([{ ...a, size: 10 }], { ...a, size: 99 })
  assert.equal(tabs[0].size, 99)
  assert.equal(tabs.length, 1)
})

test('关掉当前页签停到右边，右边没有停左边', () => {
  const tabs = [a, b, c]
  assert.deepEqual(closeTab(tabs, 'dir/b.js', 'dir/b.js'), {
    tabs: [a, c],
    active: 'dir/c.js',
  })
  assert.deepEqual(closeTab(tabs, 'dir/c.js', 'dir/c.js'), {
    tabs: [a, b],
    active: 'dir/b.js',
  })
  assert.deepEqual(closeTab([a], 'a.md', 'a.md'), { tabs: [], active: '' })
})

test('关掉别的页签不影响当前停的位置', () => {
  const tabs = [a, b]
  assert.deepEqual(closeTab(tabs, 'a.md', 'dir/b.js'), {
    tabs: [b],
    active: 'dir/b.js',
  })
})

test('改名把页签与目录下的文件一起换路径，并清掉未保存标记', () => {
  const tabs = [{ ...a, dirty: true }, b, c]
  const { tabs: next, moved } = renameTabs(tabs, 'dir', 'newdir', 'newdir')
  assert.deepEqual(
    next.map((tab) => tab.path),
    ['a.md', 'newdir/b.js', 'newdir/c.js']
  )
  assert.equal(next[0].name, 'a.md')
  assert.equal(next[1].dirty, false)
  assert.deepEqual(moved, [
    { from: 'dir/b.js', to: 'newdir/b.js' },
    { from: 'dir/c.js', to: 'newdir/c.js' },
  ])
  assert.equal(followMoved(moved, 'dir/c.js'), 'newdir/c.js')
  assert.equal(followMoved(moved, 'a.md'), 'a.md')
})

test('只改名一个文件时带上新名字', () => {
  const { tabs: next, moved } = renameTabs([a], 'a.md', 'z.md', 'z.md')
  assert.equal(next[0].name, 'z.md')
  assert.deepEqual(moved, [{ from: 'a.md', to: 'z.md' }])
})

test('查页签与改字段都按路径来', () => {
  const tabs = [a, b]
  assert.equal(tabOf(tabs, 'dir/b.js').name, 'b.js')
  assert.equal(tabOf(tabs, 'nope'), null)
  assert.equal(updateTab(tabs, 'a.md', { dirty: true })[0].dirty, true)
  assert.equal(tabs[0].dirty, false)
})
