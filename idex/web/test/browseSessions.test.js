/*
 * @Author: Himmeltala
 * @Date: 2026-11-18 22:59:31
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-18 22:59:31
 * @FilePath: \idex\web\test\browseSessions.test.js
 * @Description: 浏览页签按工作区各留一份，验证存取。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { saveSession, sessionOf } from '../src/utils/browseSessions.js'

test('没存过的返回空，空工作区 id 不记', () => {
  assert.equal(sessionOf(''), null)
  assert.equal(sessionOf('nope'), null)
  saveSession('', { tabs: [] })
  assert.equal(sessionOf(''), null)
})

test('按工作区各存一份，互不影响', () => {
  const one = { tabs: [{ path: 'a.md' }], active: 'a.md', drafts: new Map() }
  const two = { tabs: [], active: '', drafts: new Map([['b.js', 'draft']]) }
  saveSession('one', one)
  saveSession('two', two)
  assert.equal(sessionOf('one'), one)
  assert.equal(sessionOf('two').drafts.get('b.js'), 'draft')
})
