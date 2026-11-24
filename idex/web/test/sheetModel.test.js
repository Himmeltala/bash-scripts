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
import {
  SHEET_LIMITS,
  cellAddress,
  columnIndex,
  columnName,
  formatCellValue,
  formatNumber,
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

test('上限常量与设计一致', () => {
  assert.deepEqual(SHEET_LIMITS, {
    fileBytes: 20 * 1024 * 1024,
    cells: 200000,
    columns: 512,
    rows: 100000,
  })
})
