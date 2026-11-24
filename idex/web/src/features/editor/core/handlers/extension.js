/*
 * @Author: Himmeltala
 * @Date: 2026-11-24 16:05:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 21:41:59
 * @FilePath: \idex\web\src\features\editor\core\handlers\extension.js
 * @Description: 取小写扩展名，处理器与注册表共用。
 */

export function extensionOf(path) {
  const name = String(path || '').split('/').pop() || ''
  const dot = name.lastIndexOf('.')
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase()
}
