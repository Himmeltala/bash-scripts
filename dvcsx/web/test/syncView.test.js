/*
 * @Author: Himmeltala
 * @Date: 2026-11-20 01:25:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-20 01:25:00
 * @FilePath: \dvcsx\web\test\syncView.test.js
 * @Description: 同步页的提交门槛、分支下拉与确认文案。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  branchItemsOf,
  commitDisabledOf,
  committableOf,
  confirmTextOf,
  confirmTitleOf,
  findBranchOf,
  itemLabelOf,
  missingOf,
} from '../src/utils/syncView.js'

test('Git 只挡冲突，SVN 还挡未纳管与缺失', () => {
  const files = [
    { path: 'a', item: 'modified' },
    { path: 'b', item: 'conflicted' },
    { path: 'c', item: 'unversioned' },
    { path: 'd', item: 'missing' },
  ]
  assert.deepEqual(
    committableOf(files, true).map((item) => item.path),
    ['a', 'c', 'd']
  )
  assert.deepEqual(
    committableOf(files, false).map((item) => item.path),
    ['a']
  )
  assert.deepEqual(missingOf(files), ['d'])
})

test('未跟踪的写法只在 Git 下换', () => {
  assert.equal(itemLabelOf('unversioned', true), '未跟踪')
  assert.notEqual(itemLabelOf('unversioned', false), '未跟踪')
})

test('提交按钮的门槛按 Git 与 SVN 各算各的', () => {
  const base = { busy: false, writable: true, message: '说明' }
  assert.equal(commitDisabledOf({ ...base, isGit: true, conflicts: [], staged: [1], unstaged: [], picked: [] }), false)
  assert.equal(commitDisabledOf({ ...base, isGit: true, conflicts: [1], staged: [1], unstaged: [], picked: [] }), true)
  assert.equal(commitDisabledOf({ ...base, isGit: true, conflicts: [], staged: [], unstaged: [], picked: [] }), true)
  assert.equal(commitDisabledOf({ ...base, isGit: false, conflicts: [], staged: [], unstaged: [], picked: ['a'] }), false)
  assert.equal(commitDisabledOf({ ...base, isGit: false, conflicts: [], picked: [] }), true)
  assert.equal(commitDisabledOf({ ...base, message: ' ', isGit: false, picked: ['a'] }), true)
  assert.equal(commitDisabledOf({ ...base, writable: false, isGit: false, picked: ['a'] }), true)
})

test('分支下拉区分本地、远端与当前分支', () => {
  const branches = [
    { name: 'main', current: true },
    { name: 'dev', current: false },
    { name: 'feat', remote: true, start_point: 'origin/feat' },
  ]
  assert.deepEqual(
    branchItemsOf(branches).map((item) => [item.value, item.title]),
    [
      ['local:main', 'main（当前）'],
      ['local:dev', 'dev'],
      ['remote:origin/feat', 'origin/feat（远端，新建跟踪分支）'],
    ]
  )
  assert.equal(findBranchOf(branches, 'local:dev').name, 'dev')
  assert.equal(findBranchOf(branches, 'remote:origin/feat').remote, true)
  assert.equal(findBranchOf(branches, 'local:none'), undefined)
})

test('标题与确认文案按动作给', () => {
  assert.equal(confirmTitleOf('commit', null, true), '提交到 Git')
  assert.equal(confirmTitleOf('checkout', { branch: 'dev' }, true), '切换分支')
  assert.equal(confirmTitleOf('checkout', { branch: 'dev', create: true }, true), '新建分支并切换')

  const text = confirmTextOf({
    pending: 'commit',
    isGit: true,
    info: {},
    pullLabel: '只快进',
    stageAllCommit: false,
    staged: [1, 2],
    picked: [],
    message: '说明',
  })
  assert.equal(text.includes('2 项'), true)
  const svn = confirmTextOf({
    pending: 'commit',
    isGit: false,
    info: {},
    pullLabel: '只快进',
    stageAllCommit: false,
    staged: [],
    picked: ['a', 'b'],
    message: '说明',
  })
  assert.equal(svn.includes('2 个路径'), true)
})
