import test from 'node:test'
import assert from 'node:assert/strict'
import { jvmKindLabel } from '../src/utils/workspaceTabs.js'

test('JVM 类型标签', () => {
  assert.equal(jvmKindLabel('mvn'), 'Maven')
  assert.equal(jvmKindLabel('gradle'), 'Gradle')
  assert.equal(jvmKindLabel(''), '')
})
