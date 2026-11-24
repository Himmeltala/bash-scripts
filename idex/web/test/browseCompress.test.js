/*
 * @Author: Himmeltala
 * @Date: 2026-11-23 23:09:19
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-23 23:09:19
 * @FilePath: \idex\web\test\browseCompress.test.js
 * @Description: 目录压缩判定的回归测试。
*/

import test from 'node:test'
import assert from 'node:assert/strict'
import { compressiblePath } from '../src/components/browse/browseCompress.js'

test('只有非根目录才有可压缩路径', () => {
  assert.equal(compressiblePath({ type: 'dir', path: 'pkg' }), 'pkg')
  assert.equal(compressiblePath({ type: 'dir', path: 'a/b' }), 'a/b')
  assert.equal(compressiblePath({ type: 'dir', path: '' }), '')
  assert.equal(compressiblePath({ type: 'dir', path: '.' }), '')
  assert.equal(compressiblePath({ type: 'file', path: 'a.txt' }), '')
  assert.equal(compressiblePath(null), '')
})
