// 左侧分组结构的纯函数测试：平铺、折叠、环与孤儿的兜底、层级判断。
import test from 'node:test'
import assert from 'node:assert/strict'
import { flattenRows, fullNodes, inSubtree, listGroups } from '../src/utils/workspaceLayout.js'

const ws = (id, root = `/work/${id}`) => ({ id, root })
const group = (id, name, parent = '') => ({ kind: 'group', id, name, parent })
const wsNode = (id, parent = '') => ({ kind: 'ws', id, parent })

const workspaces = [ws('w1'), ws('w2'), ws('w3')]
const groups = [
  group('g1', '前端'),
  wsNode('w1', 'g1'),
  group('g2', '子组', 'g1'),
  wsNode('w2', 'g1'),
  wsNode('w3'),
]

test('平铺：层级深度与先后按节点表的位置', () => {
  const rows = flattenRows(groups, workspaces, new Set())
  assert.deepEqual(
    rows.map((r) => `${r.kind}:${r.id}@${r.depth}`),
    ['group:g1@0', 'ws:w1@1', 'group:g2@1', 'ws:w2@1', 'ws:w3@0']
  )
})

test('折叠的分组不带出子节点', () => {
  const rows = flattenRows(groups, workspaces, new Set(['g1']))
  assert.deepEqual(
    rows.map((r) => r.id),
    ['g1', 'w3']
  )
})

test('没排过的工作区补在最外层末尾', () => {
  const rows = flattenRows([group('g1', '前端'), wsNode('w1', 'g1')], workspaces, new Set())
  assert.deepEqual(
    rows.filter((r) => r.kind === 'ws').map((r) => r.id),
    ['w1', 'w2', 'w3']
  )
})

test('父级不存在的挂回最外层', () => {
  const rows = flattenRows([wsNode('w1', 'gone'), group('g1', '前端', 'gone')], workspaces, new Set())
  assert.deepEqual(
    rows.map((r) => `${r.id}@${r.depth}`),
    ['w1@0', 'g1@0', 'w2@0', 'w3@0']
  )
})

test('成环的分组也要列出来，不能无限递归', () => {
  const rows = flattenRows([group('a', 'A', 'b'), group('b', 'B', 'a')], workspaces, new Set())
  const ids = rows.filter((r) => r.kind === 'group').map((r) => r.id)
  assert.deepEqual(ids.sort(), ['a', 'b'])
  assert.equal(rows.length, 5)
})

test('移出的工作区节点直接忽略', () => {
  const rows = flattenRows([group('g1', '前端'), wsNode('gone', 'g1')], workspaces, new Set())
  assert.equal(rows.some((r) => r.id === 'gone'), false)
})

test('菜单里的分组清单带层级', () => {
  assert.deepEqual(listGroups(groups), [
    { id: 'g1', name: '前端', depth: 0 },
    { id: 'g2', name: '子组', depth: 1 },
  ])
})

test('判断子孙：自己、后代、无关的都要分得清', () => {
  assert.equal(inSubtree(groups, 'g1', 'g1'), true)
  assert.equal(inSubtree(groups, 'g1', 'g2'), true)
  assert.equal(inSubtree(groups, 'g2', 'g1'), false)
  assert.equal(inSubtree(groups, 'g1', ''), false)
})

test('补全节点表：补上没登记的工作区，丢掉已移出的', () => {
  const nodes = fullNodes([group('g1', '前端'), wsNode('w1', 'g1'), wsNode('gone', 'g1')], workspaces)
  assert.deepEqual(nodes, [
    group('g1', '前端'),
    { kind: 'ws', id: 'w1', parent: 'g1' },
    { kind: 'ws', id: 'w2', parent: '' },
    { kind: 'ws', id: 'w3', parent: '' },
  ])
})
