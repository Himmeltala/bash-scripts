/*
 * @Author: Himmeltala
 * @Date: 2026-11-23 23:09:19
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-23 23:09:19
 * @FilePath: \idex\web\src\utils\browseCompress.js
 * @Description: 目录压缩的判定：右键时判断节点能否压成同级 zip。
*/

// 目录压缩的判定：右键菜单只对目录、且相对路径非空且不是根目录时给出压缩。

export function compressiblePath(node) {
  if (!node || node.type !== 'dir') return ''
  const path = String(node.path || '').trim()
  if (!path || path === '.' || path === './') return ''
  return path
}
