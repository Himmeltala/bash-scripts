/*
 * @Author: Himmeltala
 * @Date: 2026-11-26 09:26:41
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-26 09:26:41
 * @FilePath: \idex\web\test\editorThemes.test.js
 * @Description: 编辑器主题与扩展的测试。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { EDITOR_THEMES, editorThemeExtensions, editorThemeOf } from '../src/features/editor/core/themes.js'

test('主题表包含五套预设', () => {
  assert.deepEqual(
    EDITOR_THEMES.map((item) => item.id),
    ['auto', 'github-light', 'github-dark', 'one-dark', 'dracula'],
  )
})

test('未知主题回落跟随界面', () => {
  assert.equal(editorThemeOf('no-such-theme').id, 'auto')
})

test('每套主题都有扩展', () => {
  for (const item of EDITOR_THEMES) {
    assert.ok(editorThemeExtensions(item.id).length > 0, item.id)
  }
})
