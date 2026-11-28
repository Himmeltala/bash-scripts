/*
 * @Author: Himmeltala
 * @Date: 2026-11-19 23:58:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 21:41:59
 * @FilePath: \idex\web\test\previewTypes.test.js
 * @Description: 预览类型表按扩展名归类。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { SOURCE_LABELS, isSvgPath, previewKindOf } from '../src/features/editor/core/previews/previewTypes.js'

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

test('Office 三件套按扩展名归到 office，旧格式不算', () => {
  for (const name of [
    'a.docx', 'a.doc', 'dir/报告.DOCX', 'a.xlsx', 'b.XLSM', 'c.xls', 'd.ppt', 'e.pptx', 'f.pdf',
  ]) {
    assert.equal(previewKindOf(name), 'office', name)
  }
  for (const name of ['a.csv', 'a.odt', 'a.ods', 'a.odp', 'a.txt']) {
    assert.equal(previewKindOf(name), '', name)
  }
})

test('只有图片当前能切源码，svg 单独认出来', () => {
  assert.equal(SOURCE_LABELS.image, '查看图片')
  assert.equal(isSvgPath('x/logo.SVG'), true)
  assert.equal(isSvgPath('x/logo.png'), false)
})
