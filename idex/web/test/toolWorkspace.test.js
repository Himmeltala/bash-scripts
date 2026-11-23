import test from 'node:test'
import assert from 'node:assert/strict'
import { pickToolWorkspace } from '../src/composables/useToolWorkspace.js'

test('按引擎 id 取工作区', () => {
  const state = { workspaces: [{ id: 'a' }, { id: 'b', root: '/b' }] }
  assert.equal(pickToolWorkspace(state, 'b').root, '/b')
  assert.equal(pickToolWorkspace(state, 'x'), null)
})
