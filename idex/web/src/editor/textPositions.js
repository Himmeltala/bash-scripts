/*
 * @Author: Himmeltala
 * @Date: 2026-11-20 00:26:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-20 00:26:00
 * @FilePath: \idex\web\src\editor\textPositions.js
 * @Description: 文本行列与字符偏移的换算。
 */

// 行列从 1 开始，换行按一个字符算；越界的行取到文本末尾。
export function offsetOf(text, line, column) {
  const lines = String(text || '').split('\n')
  let offset = 0
  for (let i = 0; i < line - 1 && i < lines.length; i += 1) offset += lines[i].length + 1
  return offset + Math.max(0, column - 1)
}
