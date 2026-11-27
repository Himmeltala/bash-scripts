/*
 * @Author: Himmeltala
 * @Date: 2026-11-28 12:20:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-28 12:20:00
 * @FilePath: \idex\web\test\browseArchive.test.js
 * @Description: 资源管理器解压菜单的判定：只有文件节点且后缀是 zip 才给出。
*/

import test from 'node:test'
import assert from 'node:assert/strict'
import { extractablePath } from '../src/features/browse/lib/browseArchive.js'

test('zip 文件可解压，后缀不分大小写', () => {
  assert.equal(extractablePath({ type: 'file', path: 'a/b.zip' }), 'a/b.zip')
  assert.equal(extractablePath({ type: 'file', path: 'a/b.ZIP' }), 'a/b.ZIP')
})

test('目录、非 zip 文件与空路径不给解压', () => {
  assert.equal(extractablePath({ type: 'dir', path: 'a.zip' }), '')
  assert.equal(extractablePath({ type: 'file', path: 'a.zip.txt' }), '')
  assert.equal(extractablePath({ type: 'file', path: 'a.txt' }), '')
  assert.equal(extractablePath({ type: 'file', path: '' }), '')
  assert.equal(extractablePath(null), '')
})
