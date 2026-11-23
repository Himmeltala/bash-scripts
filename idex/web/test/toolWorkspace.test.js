/*
 * @Author: Himmeltala
 * @Date: 2026-11-23 23:09:19
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-23 23:09:19
 * @FilePath: \idex\web\test\toolWorkspace.test.js
 * @Description: 引擎页签公共状态的回归测试。
*/

import test from 'node:test'
import assert from 'node:assert/strict'
import { pickToolWorkspace } from '../src/composables/useToolWorkspace.js'

test('按引擎 id 取工作区', () => {
  const state = { workspaces: [{ id: 'a' }, { id: 'b', root: '/b' }] }
  assert.equal(pickToolWorkspace(state, 'b').root, '/b')
  assert.equal(pickToolWorkspace(state, 'x'), null)
})
