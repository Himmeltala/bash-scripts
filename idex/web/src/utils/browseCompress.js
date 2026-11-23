// 目录压缩的判定：右键菜单只对目录、且相对路径非空且不是根目录时给出压缩。

export function compressiblePath(node) {
  if (!node || node.type !== 'dir') return ''
  const path = String(node.path || '').trim()
  if (!path || path === '.' || path === './') return ''
  return path
}
