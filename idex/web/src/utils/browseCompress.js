// 目录压缩后的包名：取目录名加 .zip；纯函数，与服务端的目标名一致。

export function archiveName(name) {
  const clean = String(name || '').replace(/[/\\]+$/, '')
  const base = clean.split(/[/\\]/).pop() || ''
  return `${base}.zip`
}
