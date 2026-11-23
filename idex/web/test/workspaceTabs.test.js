/*
 * @Author: Himmeltala
 * @Date: 2026-11-23 23:09:19
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-23 23:09:19
 * @FilePath: \idex\web\test\workspaceTabs.test.js
 * @Description: 工作区页签规则的回归测试。
*/

import test from 'node:test'
import assert from 'node:assert/strict'
import { needsToolDetection, workspaceTabs } from '../src/utils/workspaceTabs.js'

test('普通目录没有能力时只给浏览', () => {
  assert.deepEqual(workspaceTabs({ vcs: 'none' }), ['browse'])
  assert.deepEqual(workspaceTabs({ vcs: 'none', tools: {} }), ['browse'])
})

test('普通目录探测到能力也给引擎页签', () => {
  assert.deepEqual(workspaceTabs({ vcs: 'none', tools: { node: { root: '/a' } } }),
    ['browse', 'node'])
  assert.deepEqual(
    workspaceTabs({ vcs: 'none', tools: { node: { root: '/a' }, jvm: { root: '/b', kind: 'mvn' } } }),
    ['browse', 'node', 'jvm']
  )
})

test('前端工程追加 Node', () => {
  assert.deepEqual(workspaceTabs({ vcs: 'git', tools: { node: { root: '/a' } } }),
    ['changes', 'log', 'sync', 'browse', 'node'])
})

test('后端工程追加 JVM', () => {
  assert.deepEqual(workspaceTabs({ vcs: 'svn', tools: { jvm: { root: '/b', kind: 'mvn' } } }),
    ['changes', 'log', 'sync', 'browse', 'jvm'])
})

test('未检测过的工作区需要探测一次', () => {
  assert.equal(needsToolDetection({ vcs: 'git', tools: null }), true)
  assert.equal(needsToolDetection({ vcs: 'git', tools: {} }), false)
})
