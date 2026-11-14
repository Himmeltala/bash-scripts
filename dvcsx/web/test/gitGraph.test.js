// 时间线分列的纯函数测试：不跑浏览器，只验坐标与连线。
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildGraph, DOT_Y, LANE_W } from '../src/composables/gitGraph.js'

const PALETTE = ['#111111', '#222222', '#333333', '#444444']
const commit = (revision, ...parents) => ({ revision, parents })

const spans = (row) => row.segments.map((seg) => [seg.y1, seg.y2])

test('线性历史是一条竖线', () => {
  const { rows, width } = buildGraph(
    [commit('c', 'b'), commit('b', 'a'), commit('a')],
    PALETTE,
  )
  assert.equal(width, LANE_W + 8)
  assert.equal(rows.get('c').x, rows.get('a').x)
  // 顶端提交只有向下的一段；中间提交上下贯通；根提交到提交点为止。
  assert.deepEqual(spans(rows.get('c')), [[DOT_Y, '100%']])
  assert.deepEqual(spans(rows.get('b')), [
    [0, DOT_Y],
    [DOT_Y, '100%'],
  ])
  assert.deepEqual(spans(rows.get('a')), [[0, DOT_Y]])
})

test('合并提交引出两列，汇合点再并回一列', () => {
  const entries = [
    commit('m', 'a', 'f'),
    commit('f', 'z'),
    commit('a', 'z'),
    commit('z'),
  ]
  const { rows, width } = buildGraph(entries, PALETTE)
  const merge = rows.get('m')
  assert.equal(merge.segments.filter((seg) => seg.y1 === DOT_Y).length, 2)
  assert.equal(width, 2 * LANE_W + 8)

  const joint = rows.get('z')
  const incoming = joint.segments.filter((seg) => seg.y2 === DOT_Y)
  assert.equal(incoming.length, 2)
  // 两列都收到同一个提交点上。
  assert.ok(incoming.every((seg) => seg.x2 === joint.x))
})

test('互不相连的分支头各占一列', () => {
  const entries = [
    commit('m2', 'm1'),
    commit('d', 'z'),
    commit('m1', 'z'),
    commit('z'),
  ]
  const { rows, width } = buildGraph(entries, PALETTE)
  assert.notEqual(rows.get('m2').x, rows.get('d').x)
  assert.equal(width, 2 * LANE_W + 8)
  // z 是两条线的汇合点。
  assert.equal(rows.get('z').segments.filter((seg) => seg.y2 === DOT_Y).length, 2)
})

test('父提交不在列表里时留一段向下的线', () => {
  const { rows } = buildGraph([commit('c', 'missing')], PALETTE)
  const row = rows.get('c')
  assert.equal(row.segments.length, 1)
  assert.equal(row.segments[0].y2, '100%')
})
