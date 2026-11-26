/*
 * @Author: Himmeltala
 * @Date: 2026-11-26 11:40:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-26 13:55:00
 * @FilePath: \idex\web\src\features\terminal\lib\options.js
 * @Description: 终端外观设置到 xterm 选项的换算；字体按 CSS 字体列表原样使用。
 */

export const TERMINAL_DEFAULTS = {
  // 与代码区同款的一整串字体，和 CSS font-family 写法一致，可整条替换。
  font_family:
    "'JetBrains Mono', Roboto, 'Noto Sans SC', 'Source Han Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif",
  font_size: 14,
  line_height: 1.15,
  font_weight: 'normal',
  letter_spacing: 0,
  cursor_style: 'block',
  cursor_blink: true,
  scrollback: 5000,
}

// base: { font, size } 是应用的等宽字体栈与代码字号，设置留空时回落。
export function terminalOptions(settings, base) {
  const value = { ...TERMINAL_DEFAULTS, ...(settings || {}) }
  const family = String(value.font_family || '').trim()
  return {
    fontFamily: family || base.font,
    fontSize: value.font_size > 0 ? value.font_size : base.size,
    lineHeight: value.line_height,
    fontWeight: value.font_weight,
    letterSpacing: value.letter_spacing,
    cursorStyle: value.cursor_style,
    cursorBlink: !!value.cursor_blink,
    scrollback: value.scrollback,
  }
}
