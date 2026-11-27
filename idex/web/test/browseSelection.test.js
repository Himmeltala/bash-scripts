/*
 * @Author: Himmeltala
 * @Date: 2026-11-28 12:42:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-28 12:42:00
 * @FilePath: \idex\web\test\browseSelection.test.js
 * @Description: 多选逻辑的回归测试：切换选中、是否同一父目录。
*/

import test from 'node:test'
import assert from 'node:assert/strict'
import { sharesParent, togglePath } from '../src/features/browse/lib/browseSelection.js'

test('加入与移出选中项', () => {
  assert.deepEqual(togglePath([], 'a.txt'), ['a.txt'])
  assert.deepEqual(togglePath(['a.txt'], 'a.txt'), [])
  assert.deepEqual(togglePath(['a.txt'], 'b.txt'), ['a.txt', 'b.txt'])
})

test('空路径不改变选择', () => {
  assert.deepEqual(togglePath(['a.txt'], ''), ['a.txt'])
  assert.deepEqual(togglePath(null, ''), [])
})

test('同一父目录才算可打包', () => {
  assert.equal(sharesParent(['a.txt', 'b.txt']), true)
  assert.equal(sharesParent(['dir/a.txt', 'dir/b.txt']), true)
  assert.equal(sharesParent(['dir/a.txt', 'other/b.txt']), false)
  assert.equal(sharesParent(['a.txt']), true)
  assert.equal(sharesParent([]), true)
})
