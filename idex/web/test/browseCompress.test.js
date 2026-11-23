import test from 'node:test'
import assert from 'node:assert/strict'
import { compressiblePath } from '../src/utils/browseCompress.js'

test('只有非根目录才有可压缩路径', () => {
  assert.equal(compressiblePath({ type: 'dir', path: 'pkg' }), 'pkg')
  assert.equal(compressiblePath({ type: 'dir', path: 'a/b' }), 'a/b')
  assert.equal(compressiblePath({ type: 'dir', path: '' }), '')
  assert.equal(compressiblePath({ type: 'dir', path: '.' }), '')
  assert.equal(compressiblePath({ type: 'file', path: 'a.txt' }), '')
  assert.equal(compressiblePath(null), '')
})
