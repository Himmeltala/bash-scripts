/*
 * @Author: Himmeltala
 * @Date: 2026-11-18 23:42:17
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-18 23:42:17
 * @FilePath: \lib\web-shared\src\utils\commons\codeSymbol.js
 * @Description: 从编辑框光标位置取出标识符与 LSP 要的行列。
 */

// 标识符字符：各种文字与数字、下划线、$、@；点号、连字符留给各语言的解析器。
const WORD = /[\p{L}\p{N}_$@]/u

export function symbolAt(text, offset) {
  const source = String(text ?? '')
  if (!Number.isInteger(offset) || offset < 0 || offset > source.length) return null
  // 点在标识符右侧的空白或行尾时，浏览器把光标放在词后，往左收一个字再取；
  // 点在标点上就什么也不选。
  let start = offset
  if (start >= source.length || !WORD.test(source[start])) {
    const hit = source[start]
    if (hit !== undefined && !/\s/.test(hit)) return null
    start -= 1
  }
  if (start < 0 || !WORD.test(source[start])) return null
  let left = start
  let right = start + 1
  while (left > 0 && WORD.test(source[left - 1])) left -= 1
  while (right < source.length && WORD.test(source[right])) right += 1
  const word = source.slice(left, right)
  if (!word) return null
  // LSP 的行列从 0 起，character 按 UTF-16 计；JS 字符串下标正好也是 UTF-16。
  let line = 0
  let lineStart = 0
  for (let i = 0; i < left; i += 1) {
    if (source[i] === '\n') {
      line += 1
      lineStart = i + 1
    }
  }
  return { word, line, character: left - lineStart }
}
