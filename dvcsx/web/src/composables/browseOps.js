// 浏览页新建、改名的名字校验，以及过大文件不预览的判定；纯函数，接口那边同样有这道校验。

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
