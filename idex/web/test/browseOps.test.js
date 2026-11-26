/*
 * @Author: Himmeltala
 * @Date: 2026-11-26 09:26:41
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-26 09:26:41
 * @FilePath: \idex\web\test\browseOps.test.js
 * @Description: 浏览页名字校验与过大文件判定的测试。
 */
// 浏览页新建与改名的名字校验、过大文件占位的判定。
import test from 'node:test'
import assert from 'node:assert/strict'
import { PREVIEW_MAX, entryNameProblem, isHeldNode } from '../src/features/browse/lib/browseOps.js'

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

