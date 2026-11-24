/*
 * @Author: Himmeltala
 * @Date: 2026-11-24 10:30:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 10:30:00
 * @FilePath: \idex\web\src\utils\sheetModel.js
 * @Description: Excel 只读预览的纯逻辑，负责取字节之后的格式化、建模与可见行切片。
 */

// 与设计文档一致：文件过大不解析，单表单元格过多截断显示。
export const SHEET_LIMITS = {
  fileBytes: 20 * 1024 * 1024,
  cells: 200000,
  columns: 512,
  rows: 100000,
}

export function columnName(index) {
  let name = ''
  let n = Number(index) + 1
  while (n > 0) {
    n -= 1
    name = String.fromCharCode(65 + (n % 26)) + name
    n = Math.floor(n / 26)
  }
  return name || 'A'
}

export function columnIndex(letters) {
  let index = 0
  for (const ch of String(letters).toUpperCase()) {
    index = index * 26 + (ch.charCodeAt(0) - 64)
  }
  return index - 1
}

export function cellAddress(row, col) {
  return columnName(col) + (Number(row) + 1)
}

const pad2 = (value) => String(value).padStart(2, '0')

function formatDate(value, numFmt) {
  const hasTime = /[hs]/i.test(numFmt)
  const hasDate = /[yd]/i.test(numFmt)
  const time = `${pad2(value.getUTCHours())}:${pad2(value.getUTCMinutes())}:${pad2(value.getUTCSeconds())}`
  if (hasTime && !hasDate) return time
  const date = `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(value.getUTCDate())}`
  return hasTime ? `${date} ${time}` : date
}

// 只认常见的几种格式；认不出来就按原值显示，不猜。
export function formatNumber(value, numFmt) {
  const fmt = String(numFmt || '')
  if (value instanceof Date) return formatDate(value, fmt)
  if (typeof value !== 'number' || !Number.isFinite(value)) return String(value)
  if (!fmt || fmt === 'General' || /E[+-]/i.test(fmt)) return String(value)

  if (fmt.includes('%')) {
    const decimals = (fmt.match(/\.(0+)%/) || [])[1] || ''
    return `${(value * 100).toFixed(decimals.length)}%`
  }
  const decimals = (fmt.match(/\.(0+)/) || [])[1] || ''
  if (fmt.includes('#,##')) {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: decimals.length,
      maximumFractionDigits: decimals.length,
    })
  }
  if (fmt.includes('.')) return value.toFixed(decimals.length)
  if (fmt.includes('0')) return String(Math.round(value))
  return String(value)
}

function argbColor(color) {
  if (!color || typeof color.argb !== 'string' || color.argb.length !== 8) return ''
  return `#${color.argb.slice(2)}`
}

const BORDER_STYLES = {
  thin: '1px solid',
  medium: '2px solid',
  thick: '3px solid',
  double: '3px double',
  dashed: '1px dashed',
  dotted: '1px dotted',
  hair: '1px solid',
}

function borderCss(side) {
  if (!side || !side.style) return ''
  const line = BORDER_STYLES[side.style] || '1px solid'
  const color = argbColor(side.color)
  return color ? `${line} ${color}` : line
}

export function styleOf(cell) {
  const style = {}
  const font = cell && cell.font
  if (font) {
    if (font.bold) style.fontWeight = '700'
    if (font.italic) style.fontStyle = 'italic'
    const decoration = []
    if (font.underline) decoration.push('underline')
    if (font.strike) decoration.push('line-through')
    if (decoration.length) style.textDecoration = decoration.join(' ')
    const color = argbColor(font.color)
    if (color) style.color = color
  }
  const fill = cell && cell.fill
  if (fill && fill.pattern === 'solid') {
    const background = argbColor(fill.fgColor)
    if (background) style.backgroundColor = background
  }
  const border = cell && cell.border
  if (border) {
    for (const side of ['top', 'right', 'bottom', 'left']) {
      const css = borderCss(border[side])
      if (css) style[`border${side[0].toUpperCase()}${side.slice(1)}`] = css
    }
  }
  const alignment = cell && cell.alignment
  if (alignment) {
    if (alignment.horizontal) style.textAlign = alignment.horizontal
    if (alignment.vertical) style.verticalAlign = alignment.vertical
    if (alignment.wrapText) style.whiteSpace = 'pre-wrap'
  }
  return style
}

function parseRange(range) {
  const match = /^\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)$/i.exec(String(range).trim())
  if (!match) return null
  const row1 = Number(match[2]) - 1
  const row2 = Number(match[4]) - 1
  const col1 = columnIndex(match[1])
  const col2 = columnIndex(match[3])
  return {
    top: Math.min(row1, row2),
    left: Math.min(col1, col2),
    bottom: Math.max(row1, row2),
    right: Math.max(col1, col2),
  }
}

// actualRowCount / actualColumnCount 只算有值的格子；只有样式的空格要从稀疏行里补出来。
function usedExtent(worksheet) {
  let rows = Number(worksheet.actualRowCount) || 0
  let cols = Number(worksheet.actualColumnCount) || 0
  for (const row of (worksheet.model && worksheet.model.rows) || []) {
    rows = Math.max(rows, Number(row.number) || 0)
    for (const cell of row.cells || []) {
      const letters = /^[A-Z]+/i.exec(cell.address || '')
      if (letters) cols = Math.max(cols, columnIndex(letters[0]) + 1)
    }
  }
  return { rows, cols }
}

export function buildSheetModel(worksheet, limits = SHEET_LIMITS) {
  const extent = usedExtent(worksheet)
  const rawRows = extent.rows
  const rawCols = extent.cols
  const rowLimit = Math.min(rawRows, limits.rows)
  const colLimit = Math.min(rawCols, limits.columns)
  let truncated = rawRows > rowLimit || rawCols > colLimit

  const merges = []
  const anchors = new Map()
  const covered = new Set()
  for (const range of (worksheet.model && worksheet.model.merges) || []) {
    const parsed = parseRange(range)
    if (!parsed) continue
    const merge = {
      top: Math.max(0, parsed.top),
      left: Math.max(0, parsed.left),
      bottom: Math.min(parsed.bottom, rowLimit - 1),
      right: Math.min(parsed.right, colLimit - 1),
    }
    if (merge.bottom < merge.top || merge.right < merge.left) continue
    merges.push(merge)
    anchors.set(`${merge.top}:${merge.left}`, merge)
    for (let row = merge.top; row <= merge.bottom; row += 1) {
      for (let col = merge.left; col <= merge.right; col += 1) {
        if (row !== merge.top || col !== merge.left) covered.add(`${row}:${col}`)
      }
    }
  }

  const rows = []
  let used = 0
  let keptRows = rowLimit
  for (let row = 1; row <= rowLimit; row += 1) {
    const cells = []
    let full = false
    for (let col = 1; col <= colLimit; col += 1) {
      const key = `${row - 1}:${col - 1}`
      if (covered.has(key)) continue
      used += 1
      if (used > limits.cells) {
        truncated = true
        keptRows = row - 1
        full = true
        break
      }
      const cell = worksheet.getCell(row, col)
      const value = formatCellValue(cell)
      const style = styleOf(cell)
      const anchor = anchors.get(key)
      if (!value.text && !anchor && !Object.keys(style).length) continue
      cells.push({
        col: col - 1,
        text: value.text,
        formula: value.formula,
        style,
        colspan: anchor ? anchor.right - anchor.left + 1 : 1,
        rowspan: anchor ? anchor.bottom - anchor.top + 1 : 1,
      })
    }
    if (cells.length) rows.push({ number: row, cells })
    if (full) break
  }

  const view = (worksheet.views && worksheet.views[0]) || {}
  return {
    name: worksheet.name || '',
    rowCount: keptRows,
    colCount: colLimit,
    rows,
    merges,
    freeze: {
      rows: Number(view.ySplit) || 0,
      cols: Number(view.xSplit) || 0,
    },
    truncated,
  }
}

// 只切窗口内的行；合并区跨越窗口时把内容贴到第一个可见行，跨行数按窗口裁剪。
export function visibleRows(model, start, count) {
  const first = Math.max(0, Number(start) || 0)
  const end = Math.min(Number(model.rowCount) || 0, first + Math.max(0, Number(count) || 0))
  if (end <= first) return []

  const sourceByNumber = new Map((model.rows || []).map((row) => [row.number, row]))
  const rows = []
  for (let number = first + 1; number <= end; number += 1) {
    const source = sourceByNumber.get(number)
    rows.push({
      number,
      cells: source ? source.cells.map((cell) => ({ ...cell })) : [],
    })
  }
  const indexByNumber = new Map(rows.map((row, index) => [row.number, index]))

  for (const merge of model.merges || []) {
    if (merge.bottom < first || merge.top > end - 1) continue
    const top = Math.max(merge.top, first)
    const bottom = Math.min(merge.bottom, end - 1)
    const anchorRow = sourceByNumber.get(merge.top + 1)
    const anchorCell = anchorRow && anchorRow.cells.find((cell) => cell.col === merge.left)
    for (let row = top; row <= bottom; row += 1) {
      const target = rows[indexByNumber.get(row + 1)]
      target.cells = target.cells.filter(
        (cell) => cell.col < merge.left || cell.col > merge.right,
      )
    }
    rows[indexByNumber.get(top + 1)].cells.push({
      col: merge.left,
      text: anchorCell ? anchorCell.text : '',
      formula: anchorCell ? anchorCell.formula : '',
      style: anchorCell ? anchorCell.style : {},
      colspan: merge.right - merge.left + 1,
      rowspan: bottom - top + 1,
    })
  }
  for (const row of rows) row.cells.sort((a, b) => a.col - b.col)
  return rows
}

export function formatCellValue(cell) {
  const value = cell ? cell.value : null
  const numFmt = (cell && cell.numFmt) || ''
  if (value === null || value === undefined) return { text: '', formula: '' }

  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) {
      return { text: value.richText.map((part) => part.text || '').join(''), formula: '' }
    }
    if ('error' in value) return { text: String(value.error), formula: '' }
    if ('formula' in value || 'sharedFormula' in value) {
      const inner = formatCellValue({ value: value.result ?? null, numFmt })
      return { text: inner.text, formula: value.formula || value.sharedFormula || '' }
    }
    if ('text' in value) return { text: String(value.text), formula: '' }
  }
  if (value instanceof Date) {
    const dateFmt = /[yd]/i.test(numFmt) ? numFmt : 'yyyy-mm-dd'
    return { text: formatNumber(value, dateFmt), formula: '' }
  }
  if (typeof value === 'boolean') return { text: value ? 'TRUE' : 'FALSE', formula: '' }
  if (typeof value === 'number') return { text: formatNumber(value, numFmt), formula: '' }
  return { text: String(value), formula: '' }
}
