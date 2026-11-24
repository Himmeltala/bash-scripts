/*
 * @Author: Himmeltala
 * @Date: 2026-11-24 16:00:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 16:00:00
 * @FilePath: \idex\web\test\editorHandlers.test.js
 * @Description: 语言处理器注册表：扩展名分派、服务器对齐、语言名与格式化默认值。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { handlerOf, handlers } from '../src/editor/handlers/registry.js'

test('扩展名分派到对应处理器', () => {
  assert.equal(handlerOf('a.ts').id, 'typescript')
  assert.equal(handlerOf('a.tsx').id, 'typescript')
  assert.equal(handlerOf('a.vue').id, 'vue')
  assert.equal(handlerOf('a.py').id, 'python')
  assert.equal(handlerOf('a.sh').id, 'shell')
  assert.equal(handlerOf('a.java').id, 'java')
})

test('未知扩展名回退 generic，且没有语言服务器', () => {
  const generic = handlerOf('a.unknownext')
  assert.equal(generic.id, 'generic')
  assert.equal(generic.server, null)
})

test('每种语言的显示名、服务器与 CodeMirror 语言', () => {
  assert.deepEqual(
    ['a.js', 'a.ts', 'a.tsx'].map((path) => handlerOf(path).cmLanguage(path)),
    ['javascript', 'typescript', 'tsx'],
  )
  assert.equal(handlerOf('a.js').label('a.js'), 'JavaScript')
  assert.equal(handlerOf('a.ts').label('a.ts'), 'TypeScript')
  assert.equal(handlerOf('a.vue').server, 'vue')
  assert.equal(handlerOf('a.py').label('a.py'), 'Python')
  assert.equal(handlerOf('a.sh').label('a.sh'), 'Shell')
  assert.equal(handlerOf('a.java').label('a.java'), 'Java')
})

test('已有语言服务器 id 与后端 SERVERS 对齐', () => {
  const ids = handlers()
    .map((handler) => handler.server)
    .filter(Boolean)
    .sort()
  assert.deepEqual(ids, ['java', 'python', 'shell', 'typescript', 'vue'])
})

test('格式化默认 4 空格，不趁重构改变缩进', () => {
  for (const path of ['a.ts', 'a.vue', 'a.py', 'a.sh', 'a.java', 'a.txt']) {
    const options = handlerOf(path).formatOptions?.(path) || {}
    assert.equal(options.tabSize ?? 4, 4, path)
    assert.equal(options.insertSpaces ?? true, true, path)
  }
})

test('generic 保留现有 CodeMirror 语言覆盖', () => {
  assert.equal(handlerOf('a.html').cmLanguage('a.html'), 'html')
  assert.equal(handlerOf('a.svg').cmLanguage('a.svg'), 'xml')
  assert.equal(handlerOf('a.yaml').cmLanguage('a.yaml'), 'yaml')
  assert.equal(handlerOf('a.properties').cmLanguage('a.properties'), 'properties')
  assert.equal(handlerOf('a.toml').cmLanguage('a.toml'), '')
})
