/*
 * @Author: Himmeltala
 * @Date: 2026-11-19 23:55:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-19 23:55:00
 * @FilePath: \idex\web\src\editor\previews\previewTypes.js
 * @Description: 预览类型表，扩展名归到哪种预览器，加新类型只在这里登记。
 */

import { extensionOf } from '../../utils/browseOps.js'

export const PREVIEW_TYPES = {
  image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'svg', 'avif'],
  sheet: ['xlsx', 'xlsm'],
}

const KIND_BY_EXT = new Map()
for (const [kind, exts] of Object.entries(PREVIEW_TYPES)) {
  for (const ext of exts) KIND_BY_EXT.set(ext, kind)
}

export function previewKindOf(path) {
  return KIND_BY_EXT.get(extensionOf(path)) || ''
}

// 从预览切回源码时的按钮文字；没有这条就不用给按钮。
export const SOURCE_LABELS = {
  image: '查看图片',
}

export function isSvgPath(path) {
  return extensionOf(path) === 'svg'
}
