/*
 * @Author: Himmeltala
 * @Date: 2026-11-28 12:10:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-28 12:10:00
 * @FilePath: \idex\web\src\features\browse\lib\browseArchive.js
 * @Description: 压缩包判定：右键菜单只对 zip 文件给出解压。
 */

// 解压只支持 zip；后缀不分大小写，目录与空路径都不算。
export function extractablePath(node) {
  if (!node || node.type === 'dir') return ''
  const path = String(node.path || '').trim()
  if (!path || path === '.' || path === './') return ''
  return /\.zip$/i.test(path) ? path : ''
}
