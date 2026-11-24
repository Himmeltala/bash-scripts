/*
 * @Author: Himmeltala
 * @Date: 2026-11-24 16:05:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 16:05:00
 * @FilePath: \idex\web\src\editor\handlers\registry.js
 * @Description: 语言处理器注册表：扩展名分派、服务器查询与兜底。
 */
import generic from './generic.js'
import java from './java.js'
import python from './python.js'
import shell from './shell.js'
import typescript from './typescript.js'
import vue from './vue.js'
import { extensionOf } from './extension.js'

const LIST = [typescript, vue, python, shell, java]
const BY_EXT = new Map()

for (const handler of LIST) {
  for (const ext of handler.extensions) {
    if (BY_EXT.has(ext)) {
      throw new Error(`扩展名 ${ext} 重复注册`)
    }
    BY_EXT.set(ext, handler)
  }
}

export function handlers() {
  return [...LIST, generic]
}

export function handlerOf(path) {
  return BY_EXT.get(extensionOf(path)) || generic
}

export function handlerById(id) {
  return LIST.find((handler) => handler.id === id) || null
}
