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
