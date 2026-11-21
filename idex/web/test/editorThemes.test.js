import test from 'node:test'
import assert from 'node:assert/strict'
import { EDITOR_THEMES, editorThemeExtensions, editorThemeOf } from '../src/editor/themes.js'

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
