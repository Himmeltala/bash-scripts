/*
 * @Author: Himmeltala
 * @Date: 2026-11-23 23:09:19
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-23 23:09:19
 * @FilePath: \idex\web\test\scanWait.test.js
 * @Description: 扫描等待时限的回归测试。
*/

import test from 'node:test'
import assert from 'node:assert/strict'
import { createScanWait } from '../src/components/engines/scanWait.js'

test('扫描等待到时限就放开重试', async () => {
  let fired = false
  const wait = createScanWait({ limit: 10, onTimeout: () => (fired = true) })
  wait.start()
  await new Promise((resolve) => setTimeout(resolve, 25))
  assert.equal(fired, true)
})

test('停掉等待后不再触发', async () => {
  let fired = false
  const wait = createScanWait({ limit: 10, onTimeout: () => (fired = true) })
  wait.start()
  wait.stop()
  await new Promise((resolve) => setTimeout(resolve, 25))
  assert.equal(fired, false)
})

test('重新开始只留最后一次等待', async () => {
  let count = 0
  const wait = createScanWait({ limit: 10, onTimeout: () => (count += 1) })
  wait.start()
  wait.start()
  await new Promise((resolve) => setTimeout(resolve, 25))
  assert.equal(count, 1)
  wait.stop()
})
