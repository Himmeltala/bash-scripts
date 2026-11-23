import test from 'node:test'
import assert from 'node:assert/strict'
import { archiveName } from '../src/utils/browseCompress.js'

test('包名取目录名加 .zip', () => {
  assert.equal(archiveName('pkg'), 'pkg.zip')
  assert.equal(archiveName('a/b'), 'b.zip')
})
