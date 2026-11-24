/*
 * @Author: Himmeltala
 * @Date: 2026-11-24 16:00:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 21:41:59
 * @FilePath: \idex\web\test\languageExtension.test.js
 * @Description: CodeMirror 语言键到扩展的映射。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { languageExtension } from '../src/features/editor/core/languageExtension.js'

test('语言键都能生成 CodeMirror 扩展', () => {
  for (const key of [
    'javascript',
    'jsx',
    'typescript',
    'tsx',
    'vue',
    'python',
    'shell',
    'html',
    'xml',
    'sql',
    'yaml',
    'properties',
  ]) {
    assert.ok(languageExtension(key).length > 0, key)
  }
  assert.equal(languageExtension('').length, 0)
  assert.equal(languageExtension('no-such-language').length, 0)
})
