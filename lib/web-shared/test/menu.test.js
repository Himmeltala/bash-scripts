// 右键菜单摆位：靠边时往回收，始终整块留在窗口里。
import test from 'node:test'
import assert from 'node:assert/strict'
import { clampMenuPosition } from '../src/utils/commons/menu.js'

const viewport = { width: 1000, height: 700 }

test('位置够放时原样返回', () => {
  assert.deepEqual(
    clampMenuPosition({ x: 120, y: 80, width: 200, height: 160, viewport }),
    { x: 120, y: 80 },
  )
})

test('右边缘超出时贴右边内缩一个边距', () => {
  assert.deepEqual(
    clampMenuPosition({ x: 960, y: 80, width: 200, height: 160, viewport, margin: 8 }),
    { x: 792, y: 80 },
  )
})

test('下边缘超出时贴底边内缩', () => {
  assert.deepEqual(
    clampMenuPosition({ x: 100, y: 690, width: 200, height: 160, viewport, margin: 8 }),
    { x: 100, y: 532 },
  )
})

test('窗口比菜单还小时贴到边距上，不出窗口', () => {
  assert.deepEqual(
    clampMenuPosition({ x: 300, y: 300, width: 900, height: 900, viewport, margin: 8 }),
    { x: 92, y: 8 },
  )
})
