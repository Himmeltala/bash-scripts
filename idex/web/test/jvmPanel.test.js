/*
 * @Author: Himmeltala
 * @Date: 2026-11-23 23:09:19
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-23 23:09:19
 * @FilePath: \idex\web\test\jvmPanel.test.js
 * @Description: JVM 页签辅助函数的回归测试。
*/

import test from 'node:test'
import assert from 'node:assert/strict'
import { jvmKindLabel } from '../src/utils/workspaceTabs.js'

test('JVM 类型标签', () => {
  assert.equal(jvmKindLabel('mvn'), 'Maven')
  assert.equal(jvmKindLabel('gradle'), 'Gradle')
  assert.equal(jvmKindLabel(''), '')
})
