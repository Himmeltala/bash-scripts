/*
 * @Author: Himmeltala
 * @Date: 2026-11-20 01:10:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 21:41:59
 * @FilePath: \idex\web\test\changesView.test.js
 * @Description: 变更页的分组、差异口径与行内动作。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { groupsFor, keyOf, rowActionOf, scopeOf } from '../src/features/changes/lib/changesView.js'

test('Git 三组，SVN 只有更改一组', () => {
  assert.deepEqual(
    groupsFor(true).map((group) => group.key),
    ['staged', 'unstaged', 'conflicts']
  )
  assert.deepEqual(
    groupsFor(false).map((group) => group.key),
    ['unstaged']
  )
})

test('差异口径按组定，键带上口径', () => {
  assert.equal(scopeOf('staged'), 'staged')
  assert.equal(scopeOf('conflicts'), 'head')
  assert.equal(scopeOf('unstaged'), 'worktree')
  assert.equal(keyOf('staged', 'a.txt'), 'staged:a.txt')
  assert.equal(keyOf('conflicts', 'a.txt'), 'head:a.txt')
})

test('Git 的行内动作按组给，冲突给标记已解决', () => {
  assert.equal(rowActionOf('staged', { item: 'modified' }, true).title, '取消暂存')
  assert.equal(rowActionOf('unstaged', { item: 'modified' }, true).title, '暂存')
  assert.equal(rowActionOf('conflicts', { item: 'conflict' }, true).title, '标记已解决')
})

test('SVN 按文件状态给纳入与撤回纳入', () => {
  assert.equal(rowActionOf('unstaged', { item: 'unversioned' }, false).title, '纳入版本控制')
  assert.equal(
    rowActionOf('unstaged', { item: 'added' }, false).title,
    '取消纳入版本控制，文件留在工作副本里'
  )
  assert.equal(rowActionOf('unstaged', { item: 'modified' }, false), null)
})
