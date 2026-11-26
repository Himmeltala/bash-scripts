/*
 * @Author: Himmeltala
 * @Date: 2026-11-26 09:26:41
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-26 09:26:41
 * @FilePath: \idex\web\src\features\browse\lib\browseOps.js
 * @Description: 浏览页新建与改名的名字校验、过大文件判定和路径小工具。
 */
// 浏览页新建、改名的名字校验，过大文件不预览的判定，以及几个通用的路径小工具；纯函数，接口那边同样有这道校验。

// 跟服务端 MAX_FILE 一致：超过它的文件读不出来，右侧只给下载。
export const PREVIEW_MAX = 512 * 1024

// 名字只认单个文件名或目录名；空、. 与 .. 之外都不能带路径分隔符。
export function entryNameProblem(name) {
  if (!name) return '名字不能为空'
  if (name === '.' || name === '..' || /[/\\]/.test(name)) return '名字里不能带路径分隔符'
  return ''
}

export function isHeldNode(node) {
  return !!node && node.type === 'file' && Number(node.size) > PREVIEW_MAX
}

export function extensionOf(path) {
  const name = String(path || '')
  const dot = name.lastIndexOf('.')
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase()
}
