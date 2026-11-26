/*
 * @Author: Himmeltala
 * @Date: 2026-11-26 11:40:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-26 13:55:00
 * @FilePath: \idex\web\test\terminalOptions.test.js
 * @Description: 终端外观设置换算成 xterm 选项的测试。
 */
// 终端字体按 CSS 字体列表原样用；空着才回落到应用默认等宽字体。
import test from 'node:test'
import assert from 'node:assert/strict'
import { TERMINAL_DEFAULTS, terminalOptions } from '../src/features/terminal/lib/options.js'

const base = { font: "'JetBrains Mono', monospace", size: 13.76 }

test('默认值给出一整串字体列表', () => {
  const out = terminalOptions({}, base)
  assert.equal(out.fontFamily, TERMINAL_DEFAULTS.font_family)
  assert.match(out.fontFamily, /JetBrains Mono/)
  assert.match(out.fontFamily, /sans-serif/)
  assert.equal(out.fontSize, 14)
  assert.equal(out.lineHeight, 1.15)
  assert.equal(out.cursorStyle, 'block')
  assert.equal(out.cursorBlink, true)
  assert.equal(out.scrollback, 5000)
})

test('填进来的字体列表原样使用，不自动拼默认字体', () => {
  const out = terminalOptions({ font_family: "'Fira Code', monospace" }, base)
  assert.equal(out.fontFamily, "'Fira Code', monospace")
})

test('字体留空时回落到应用的等宽字体', () => {
  const out = terminalOptions({ font_family: '  ' }, base)
  assert.equal(out.fontFamily, base.font)
})

test('数值选项原样带过去', () => {
  const out = terminalOptions(
    { font_size: 15.5, line_height: 1.4, font_weight: 'bold', letter_spacing: 1, cursor_style: 'bar', cursor_blink: false, scrollback: 2000 },
    base,
  )
  assert.equal(out.fontSize, 15.5)
  assert.equal(out.lineHeight, 1.4)
  assert.equal(out.fontWeight, 'bold')
  assert.equal(out.letterSpacing, 1)
  assert.equal(out.cursorStyle, 'bar')
  assert.equal(out.cursorBlink, false)
  assert.equal(out.scrollback, 2000)
})

test('旧数据里的字号 0 回落到代码字号', () => {
  const out = terminalOptions({ font_size: 0 }, base)
  assert.equal(out.fontSize, base.size)
})
