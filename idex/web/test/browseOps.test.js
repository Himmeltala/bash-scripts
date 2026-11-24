// 浏览页新建与改名的名字校验、过大文件占位的判定。
import test from 'node:test'
import assert from 'node:assert/strict'
import { PREVIEW_MAX, entryNameProblem, isHeldNode } from '../src/components/browse/browseOps.js'

test('普通名字放行', () => {
  for (const name of ['a.txt', '说明.md', '新 目录', 'a..b']) {
    assert.equal(entryNameProblem(name), '', name)
  }
})

test('空名与路径分隔符被拦下', () => {
  for (const name of ['', '.', '..', 'a/b', 'a\\b']) {
    assert.notEqual(entryNameProblem(name), '', name)
  }
})

test('超过预览上限的文件才占位', () => {
  assert.equal(isHeldNode({ type: 'file', size: PREVIEW_MAX }), false)
  assert.equal(isHeldNode({ type: 'file', size: PREVIEW_MAX + 1 }), true)
  assert.equal(isHeldNode({ type: 'dir', size: PREVIEW_MAX * 2 }), false)
  assert.equal(isHeldNode(null), false)
})

