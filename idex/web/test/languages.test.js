import test from 'node:test'
import assert from 'node:assert/strict'
import { cmLanguageOf, languageExtension } from '../src/editor/languages.js'

test('常见扩展名映射到 CM6 语言键', () => {
  assert.equal(cmLanguageOf('a.ts'), 'typescript')
  assert.equal(cmLanguageOf('a.tsx'), 'tsx')
  assert.equal(cmLanguageOf('a.vue'), 'vue')
  assert.equal(cmLanguageOf('a.py'), 'python')
  assert.equal(cmLanguageOf('a.sh'), 'shell')
  assert.equal(cmLanguageOf('a.html'), 'html')
  assert.equal(cmLanguageOf('a.svg'), 'xml')
  assert.equal(cmLanguageOf('a.properties'), 'properties')
})

test('没有语言包或认不出的扩展名回落纯文本', () => {
  assert.equal(cmLanguageOf('a.toml'), '')
  assert.equal(cmLanguageOf('LICENSE'), '')
  assert.equal(cmLanguageOf(''), '')
})

test('未知语言键返回空扩展', () => {
  assert.equal(languageExtension('').length, 0)
  assert.equal(languageExtension('no-such-language').length, 0)
})
