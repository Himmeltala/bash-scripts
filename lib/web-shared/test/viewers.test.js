import test from 'node:test'
import assert from 'node:assert/strict'
import {
  defaultModeOf,
  handlerOf,
  modesOf,
  resolveMode,
  usesEditorSlot,
  viewForOpen,
  viewLoadFailure,
} from '../src/components/commons/FileEditor/handlers/registry.js'
import { languageOf } from '../src/utils/commons/highlight.js'

test('按扩展名分配处理器：markdown、代码、纯文本', () => {
  assert.equal(handlerOf('README.md').id, 'markdown')
  assert.equal(handlerOf('notes.MARKDOWN').id, 'markdown')
  assert.equal(handlerOf('a.ts').id, 'code')
  assert.equal(handlerOf('a.java').id, 'code')
  assert.equal(handlerOf('a.txt').id, 'plain')
  assert.equal(handlerOf('Makefile').id, 'plain')
  assert.equal(handlerOf('').id, 'plain')
})

test('toml 按代码着色处理，与 ini 共用一套高亮', () => {
  assert.equal(languageOf('config.toml'), 'toml')
  assert.equal(handlerOf('config.toml').id, 'code')
  assert.deepEqual(modesOf('config.toml').map((m) => m.id), ['source'])
})

test('markdown 默认双栏，其它类型默认第一个视图', () => {
  assert.equal(defaultModeOf('README.md'), 'split')
  assert.equal(defaultModeOf('a.txt'), '')
})

test('markdown 有源码、视图与双栏，代码与纯文本只有源码', () => {
  assert.deepEqual(modesOf('README.md').map((m) => m.id), ['source', 'render', 'split'])
  assert.deepEqual(modesOf('a.ts').map((m) => m.id), ['source'])
  assert.deepEqual(modesOf('a.txt').map((m) => m.id), ['source'])
})

test('当前模式不在列表里就回这一类第一个视图', () => {
  assert.equal(resolveMode('split', modesOf('README.md')), 'split')
  assert.equal(resolveMode('render', modesOf('README.md')), 'render')
  assert.equal(resolveMode('render', modesOf('a.txt')), 'source')
  assert.equal(resolveMode('source', modesOf('README.md')), 'source')
})

test('带行号打开时纯渲染回源码，双栏保持', () => {
  assert.equal(viewForOpen('render', 12), 'source')
  assert.equal(viewForOpen('render', 0), 'render')
  assert.equal(viewForOpen('split', 12), 'split')
  assert.equal(viewForOpen('source', 12), 'source')
})

test('视图加载失败退回源码并带上原因', () => {
  const out = viewLoadFailure(new Error('分块没了'))
  assert.equal(out.mode, 'source')
  assert.ok(out.message.includes('分块没了'))
  assert.equal(viewLoadFailure(null).mode, 'source')
})

test('只有代码文件允许插槽接管', () => {
  assert.equal(usesEditorSlot('a.py', true), true)
  assert.equal(usesEditorSlot('a.py', false), false)
  assert.equal(usesEditorSlot('a.md', true), false)
  assert.equal(usesEditorSlot('LICENSE', true), false)
})
