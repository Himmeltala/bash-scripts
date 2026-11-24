// 统一差异按行拆开：给编辑器标出新增、修改、删除的行，点击时能拿出原内容。

const HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/

export function parseDiffHunks(text) {
  const hunks = []
  let current = null
  for (const raw of String(text || '').split('\n')) {
    const match = HEADER.exec(raw)
    if (match) {
      if (current) hunks.push(current)
      current = {
        header: raw,
        oldStart: Number(match[1]),
        oldLines: Number(match[2] || 1),
        newStart: Number(match[3]),
        newLines: Number(match[4] || 1),
        lines: [],
      }
      continue
    }
    if (!current) continue
    if (raw.startsWith(' ') || raw.startsWith('+') || raw.startsWith('-') || raw.startsWith('\\')) {
      current.lines.push({ kind: raw[0], text: raw.slice(1) })
      continue
    }
    hunks.push(current)
    current = null
  }
  if (current) hunks.push(current)
  for (const hunk of hunks) {
    hunk.text = [hunk.header, ...hunk.lines.map((line) => line.kind + line.text)].join('\n')
  }
  return hunks
}

// 行号从 1 起。一块里既有删又有加，加的行算修改；只剩删的块，在删的位置标删除。
export function diffMarks(hunks) {
  const marks = {}
  ;(hunks || []).forEach((hunk, index) => {
    let line = hunk.newStart
    let removed = 0
    let added = 0
    for (const item of hunk.lines || []) {
      if (item.kind === '+') {
        marks[line] = { kind: removed ? 'modify' : 'add', hunk: index }
        line += 1
        added += 1
      } else if (item.kind === ' ') {
        line += 1
      } else if (item.kind === '-') {
        removed += 1
      }
    }
    if (removed && !added) {
      const at = Math.max(1, hunk.newStart)
      marks[at] = { kind: 'delete', hunk: index }
    }
  })
  return marks
}

// 这一块的原文：上下文行与减号行，去掉加号行。
export function hunkOriginal(hunk) {
  if (!hunk) return ''
  return (hunk.lines || [])
    .filter((item) => item.kind !== '+')
    .map((item) => item.text)
    .join('\n')
}
