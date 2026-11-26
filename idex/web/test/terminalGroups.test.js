/*
 * @Author: Himmeltala
 * @Date: 2026-11-26 10:20:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-26 17:05:00
 * @FilePath: \idex\web\test\terminalGroups.test.js
 * @Description: 终端按工作区分组的名称、数量与查看组回落的测试。
 */
// Dock 标题栏的分组与查看组：只列有终端的组，查看组失效时回落当前工作区。
import test from 'node:test'
import assert from 'node:assert/strict'
import { displayName, groupRows, hasAnyTerminal, missingSessions, resolveView } from '../src/features/terminal/lib/groups.js'

const ws = [
  { id: 'a', alias: '主工程', root: '/home/x/idex' },
  { id: 'b', alias: '', root: '/home/x/llmx' },
]
const groups = { a: { items: [{}, {}], activeKey: 't1' }, b: { items: [{}], activeKey: 't2' } }

test('分组按工作区顺序给出名称与数量', () => {
  assert.deepEqual(groupRows(groups, ws), [
    { wsId: 'a', name: '主工程', count: 2 },
    { wsId: 'b', name: 'llmx', count: 1 },
  ])
})

test('空组与已移除工作区不出现', () => {
  assert.deepEqual(groupRows({ a: { items: [] }, gone: { items: [{}] } }, ws), [])
})

test('查看组失效时回落到当前工作区', () => {
  assert.equal(resolveView('b', 'a', groups), 'b')
  assert.equal(resolveView('gone', 'a', groups), 'a')
  assert.equal(resolveView('b', '', groups), 'b')
  assert.equal(resolveView('b', '', { b: { items: [] } }), '')
  assert.equal(resolveView('', '', groups), '')
})

test('没有别名时用目录名', () => {
  assert.equal(displayName(ws[1]), 'llmx')
  assert.equal(displayName({ root: '/tmp/x/idex/' }), 'idex')
})

test('服务端会话里只补本地没有的', () => {
  const items = [{ key: 'term-1', id: 'a' }, { key: 'term-2', id: '' }]
  const sessions = [{ id: 'a' }, { id: 'b' }, { id: '' }, null]
  assert.deepEqual(missingSessions(items, sessions), [{ id: 'b' }])
})

test('只有任何工作区都没终端时才算首次', () => {
  assert.equal(hasAnyTerminal({}), false)
  assert.equal(hasAnyTerminal({ a: { items: [] }, b: { items: [] } }), false)
  assert.equal(hasAnyTerminal({ a: { items: [{}] } }), true)
})
