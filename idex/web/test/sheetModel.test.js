/*
 * @Author: Himmeltala
 * @Date: 2026-11-24 10:30:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 10:30:00
 * @FilePath: \idex\web\test\sheetModel.test.js
 * @Description: Excel 只读预览的纯逻辑：列名、值格式、样式、建模与可见行。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import ExcelJS from 'exceljs'
import {
  SHEET_LIMITS,
  buildSheetModel,
  cellAddress,
  columnIndex,
  columnName,
  formatCellValue,
  formatNumber,
  styleOf,
} from '../src/utils/sheetModel.js'

test('列名与地址换算', () => {
  assert.equal(columnName(0), 'A')
  assert.equal(columnName(25), 'Z')
  assert.equal(columnName(26), 'AA')
  assert.equal(columnIndex('A'), 0)
  assert.equal(columnIndex('AA'), 26)
  assert.equal(cellAddress(0, 0), 'A1')
  assert.equal(cellAddress(9, 27), 'AB10')
})

test('数字格式子集', () => {
  assert.equal(formatNumber(42, '0'), '42')
  assert.equal(formatNumber(3.14159, '0.00'), '3.14')
  assert.equal(formatNumber(1234.5, '#,##0.00'), '1,234.50')
  assert.equal(formatNumber(0.1234, '0.0%'), '12.3%')
  assert.equal(formatNumber(1234.5, 'General'), '1234.5')
  assert.equal(formatNumber(3.14159, '0.00E+00'), '3.14159')
})

test('日期按 UTC 分量格式化，不随本机时区偏移', () => {
  const value = new Date(Date.UTC(2026, 10, 24, 9, 5, 6))
  assert.equal(formatNumber(value, 'yyyy-mm-dd'), '2026-11-24')
  assert.equal(formatNumber(value, 'yyyy-mm-dd hh:mm:ss'), '2026-11-24 09:05:06')
  assert.equal(formatNumber(value, 'hh:mm:ss'), '09:05:06')
})

test('单元格值：文本、布尔、错误、公式、富文本、日期', () => {
  assert.deepEqual(formatCellValue({ value: 'abc', numFmt: '' }), { text: 'abc', formula: '' })
  assert.deepEqual(formatCellValue({ value: true, numFmt: '' }), { text: 'TRUE', formula: '' })
  assert.deepEqual(formatCellValue({ value: { error: '#DIV/0!' }, numFmt: '' }), {
    text: '#DIV/0!',
    formula: '',
  })
  assert.deepEqual(formatCellValue({ value: { formula: 'A1+B1', result: 3 }, numFmt: '0' }), {
    text: '3',
    formula: 'A1+B1',
  })
  assert.deepEqual(
    formatCellValue({ value: { richText: [{ text: 'a' }, { text: 'b' }] }, numFmt: '' }),
    { text: 'ab', formula: '' },
  )
  assert.deepEqual(
    formatCellValue({ value: { text: '链接', hyperlink: 'https://x' }, numFmt: '' }),
    { text: '链接', formula: '' },
  )
  const date = new Date(Date.UTC(2026, 10, 24, 9, 5, 6))
  assert.deepEqual(formatCellValue({ value: date, numFmt: 'yyyy-mm-dd' }), {
    text: '2026-11-24',
    formula: '',
  })
  assert.deepEqual(formatCellValue({ value: null, numFmt: '' }), { text: '', formula: '' })
})

test('字体、填充、对齐映射成内联样式', () => {
  const style = styleOf({
    font: { bold: true, italic: true, underline: true, strike: true, color: { argb: 'FF112233' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEE00' } },
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
  })
  assert.equal(style.fontWeight, '700')
  assert.equal(style.fontStyle, 'italic')
  assert.equal(style.textDecoration, 'underline line-through')
  assert.equal(style.color, '#112233')
  assert.equal(style.backgroundColor, '#FFEE00')
  assert.equal(style.textAlign, 'center')
  assert.equal(style.verticalAlign, 'middle')
  assert.equal(style.whiteSpace, 'pre-wrap')
})

test('边框映射线型，无样式与主题色不输出', () => {
  const style = styleOf({
    border: {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'double', color: { argb: 'FF000000' } },
    },
    font: { color: { theme: 1 } },
  })
  assert.equal(style.borderTop, '1px solid #000000')
  assert.equal(style.borderBottom, '3px double #000000')
  assert.equal(style.color, undefined)
  assert.deepEqual(styleOf({}), {})
})

function sheetOf(build) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Sheet1')
  build(sheet)
  return sheet
}

test('建模：值、样式、合并、冻结与空格省略', () => {
  const sheet = sheetOf((ws) => {
    ws.getCell('A1').value = '标题'
    ws.getCell('A1').font = { bold: true }
    ws.getCell('B2').value = 3.14159
    ws.getCell('B2').numFmt = '0.00'
    ws.mergeCells('A1:B2')
    ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 2 }]
  })
  const model = buildSheetModel(sheet)
  assert.equal(model.name, 'Sheet1')
  assert.deepEqual(model.merges, [{ top: 0, left: 0, bottom: 1, right: 1 }])
  assert.deepEqual(model.freeze, { rows: 2, cols: 1 })
  assert.equal(model.rows[0].cells.length, 1)
  assert.equal(model.rows[0].cells[0].text, '标题')
  assert.equal(model.rows[0].cells[0].colspan, 2)
  assert.equal(model.rows[0].cells[0].rowspan, 2)
  assert.equal(model.rows[0].cells[0].style.fontWeight, '700')
})

test('建模：只保留有值或有样式的单元格', () => {
  const sheet = sheetOf((ws) => {
    ws.getCell('A1').value = 'x'
    ws.getCell('C3').border = { top: { style: 'thin', color: { argb: 'FF000000' } } }
  })
  const model = buildSheetModel(sheet)
  const kept = model.rows.flatMap((row) => row.cells.map((cell) => `${row.number}:${cell.col}`))
  assert.deepEqual(kept, ['1:0', '3:2'])
})

test('建模：超过单元格上限时截断并标记', () => {
  const sheet = sheetOf((ws) => {
    for (let r = 1; r <= 5; r += 1) {
      for (let c = 1; c <= 5; c += 1) ws.getCell(r, c).value = `${r}-${c}`
    }
  })
  const model = buildSheetModel(sheet, { ...SHEET_LIMITS, cells: 7 })
  assert.equal(model.truncated, true)
  const kept = model.rows.reduce((sum, row) => sum + row.cells.length, 0)
  assert.ok(kept <= 7)
})

test('建模：没有冻结设置时 freeze 为零', () => {
  const model = buildSheetModel(sheetOf((ws) => { ws.getCell('A1').value = 1 }))
  assert.deepEqual(model.freeze, { rows: 0, cols: 0 })
})

test('上限常量与设计一致', () => {
  assert.deepEqual(SHEET_LIMITS, {
    fileBytes: 20 * 1024 * 1024,
    cells: 200000,
    columns: 512,
    rows: 100000,
  })
})
