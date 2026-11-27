/*
 * @Author: Himmeltala
 * @Date: 2026-11-27 10:04:22
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-27 10:04:22
 * @FilePath: \idex\web\test\recentWorkspaces.test.js
 * @Description: 最近打开工作区顺序的回归测试。
*/

import test from 'node:test'
import assert from 'node:assert/strict'
import { pruneRecent, pushRecent, vcsMeta } from '../src/features/workspaces/lib/recent.js'

test('打开的工作区排到最前', () => {
  assert.deepEqual(pushRecent(['a', 'b', 'c'], 'c'), ['c', 'a', 'b'])
})

test('重复打开不添重复项', () => {
  assert.deepEqual(pushRecent(['a', 'b'], 'b'), ['b', 'a'])
})

test('超出上限丢掉最旧的', () => {
  assert.deepEqual(pushRecent(['a', 'b', 'c'], 'd', 3), ['d', 'a', 'b'])
})

test('空 id 不改动顺序', () => {
  assert.deepEqual(pushRecent(['a', 'b'], ''), ['a', 'b'])
  assert.deepEqual(pushRecent(null, ''), [])
  assert.deepEqual(pushRecent(undefined, 'a'), ['a'])
})

test('清掉登记表里已经没有的工作区', () => {
  assert.deepEqual(pruneRecent(['a', 'b', 'c'], ['b', 'c']), ['b', 'c'])
  assert.deepEqual(pruneRecent(['a'], new Set(['a'])), ['a'])
  assert.deepEqual(pruneRecent(null, ['a']), [])
})

test('版本库类型图标', () => {
  assert.equal(vcsMeta('git').icon, 'mdi-git')
  assert.equal(vcsMeta('svn').icon, 'mdi-source-repository')
  assert.equal(vcsMeta('none').icon, 'mdi-folder-outline')
})
