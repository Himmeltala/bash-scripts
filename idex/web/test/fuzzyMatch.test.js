/*
 * @Author: Himmeltala
 * @Date: 2026-11-19 02:10:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-19 02:10:00
 * @FilePath: \idex\web\test\fuzzyMatch.test.js
 * @Description: 快速打开的模糊匹配与排序。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { filterPaths, fuzzyScore } from '../src/utils/fuzzyMatch.js'

test('按顺序命中才算，没命中返回 -1', () => {
  assert.equal(fuzzyScore('ab', 'a/b.js') >= 0, true)
  assert.equal(fuzzyScore('ba', 'a/b.js'), -1)
  assert.equal(fuzzyScore('', 'anything'), 0)
})

test('命中越靠前分数越小', () => {
  assert.ok(fuzzyScore('a', 'a.js') < fuzzyScore('a', 'x/a.js'))
})

test('过滤后按分数与路径排，限制条数', () => {
  const paths = ['src/app.js', 'app/main.js', 'docs/readme.md', 'deep/app/x.js']
  const hits = filterPaths(paths, 'app')
  assert.equal(hits.length, 3)
  assert.deepEqual(hits, ['app/main.js', 'src/app.js', 'deep/app/x.js'])
  assert.equal(filterPaths(paths, 'zzz').length, 0)
  assert.equal(filterPaths(paths, '', 2).length, 2)
})
