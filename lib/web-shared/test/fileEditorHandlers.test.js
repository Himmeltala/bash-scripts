import test from 'node:test'
import assert from 'node:assert/strict'
import { handlerOf, modesOf, usesCodeView } from '../src/components/commons/FileEditor/handlers/registry.js'

const fakeCode = { id: 'fake-code', modes: [{ id: 'source', title: '源码', load: () => null }] }

test('不传 codeView 时代码文件仍走默认处理器', () => {
  assert.equal(handlerOf('a.py').id, 'code')
})

test('传 codeView 时代码文件优先用它', () => {
  assert.equal(handlerOf('a.py', fakeCode).id, 'fake-code')
  assert.equal(modesOf('a.py', fakeCode), fakeCode.modes)
})

test('markdown 与未知扩展名不受 codeView 影响', () => {
  assert.equal(handlerOf('a.md', fakeCode).id, 'markdown')
  assert.equal(handlerOf('LICENSE', fakeCode).id, 'plain')
})

test('只有代码文件才让 codeView 接管', () => {
  assert.equal(usesCodeView('a.py', fakeCode), true)
  assert.equal(usesCodeView('a.md', fakeCode), false)
  assert.equal(usesCodeView('LICENSE', fakeCode), false)
  assert.equal(usesCodeView('a.py', null), false)
})
