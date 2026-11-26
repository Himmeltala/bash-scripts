/*
 * @Author: Himmeltala
 * @Date: 2026-11-26 09:26:41
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-26 09:26:41
 * @FilePath: \idex\web\src\features\editor\core\positions.js
 * @Description: LSP 的 0 基行列与文档偏移互算，越界时夹到边界。
 */
// LSP 的 0 基行列换算成文档偏移；超过行尾夹到行尾，行号越界夹到末尾。

export function offsetAt(text, line, character) {
  const source = String(text ?? '')
  const target = Math.max(0, Number(line) || 0)
  let start = 0
  let current = 0
  while (current < target) {
    const next = source.indexOf('\n', start)
    if (next < 0) return source.length
    start = next + 1
    current += 1
  }
  const end = source.indexOf('\n', start)
  const lineEnd = end < 0 ? source.length : end
  return Math.min(start + Math.max(0, Number(character) || 0), lineEnd)
}
