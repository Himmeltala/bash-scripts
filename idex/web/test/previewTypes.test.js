/*
 * @Author: Himmeltala
 * @Date: 2026-11-19 23:58:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-19 23:58:00
 * @FilePath: \idex\web\test\previewTypes.test.js
 * @Description: 预览类型表按扩展名归类。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { SOURCE_LABELS, isSvgPath, previewKindOf } from '../src/editor/previews/previewTypes.js'

test('图片按扩展名认，大小写都算', () => {
  for (const name of [
    'a.png',
    'dir/b.JPG',
    'c.jpeg',
    'd.gif',
    'e.webp',
    'f.bmp',
    'g.ico',
    'h.svg',
    'i.avif',
  ]) {
    assert.equal(previewKindOf(name), 'image', name)
  }
})

test('不认识的扩展名与没扩展名的不算预览', () => {
  for (const name of ['a.txt', 'b.md', 'png', 'x/png.svg.txt', '', 'a.']) {
    assert.equal(previewKindOf(name), '', name)
  }
})

test('Excel 表格按扩展名认，xls 与 csv 不算', () => {
  assert.equal(previewKindOf('a.xlsx'), 'sheet')
  assert.equal(previewKindOf('dir/b.XLSM'), 'sheet')
  assert.equal(previewKindOf('a.xls'), '')
  assert.equal(previewKindOf('a.csv'), '')
})

test('只有图片当前能切源码，svg 单独认出来', () => {
  assert.equal(SOURCE_LABELS.image, '查看图片')
  assert.equal(isSvgPath('x/logo.SVG'), true)
  assert.equal(isSvgPath('x/logo.png'), false)
})
