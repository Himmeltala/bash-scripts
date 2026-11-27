/*
 * @Author: Himmeltala
 * @Date: 2026-11-28 10:50:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-28 10:50:00
 * @FilePath: \idex\web\test\settingsView.test.js
 * @Description: 设置弹窗视图逻辑的回归测试：搜索、只看已修改与分组。
*/

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  filterSettings,
  groupModified,
  groupSettings,
  matchesSetting,
  parseQuery,
} from '../src/features/settings/lib/settingsView.js'
import { runTypeVisible } from '../src/features/settings/lib/runTypes.js'

const SCHEMA = [
  { key: 'terminal.font_size', label: '字号', description: '像素值', group: '终端', section: '字体' },
  { key: 'terminal.line_height', label: '行高', description: '倍数', group: '终端', section: '字体' },
  { key: 'editor.theme', label: '代码配色', description: '', group: '编辑器', section: '外观' },
  { key: 'header.metrics.cpu', label: 'CPU', description: '', group: '顶栏', section: '指标' },
]

test('搜索词按空格拆开，@modified 单独当过滤开关', () => {
  assert.deepEqual(parseQuery(' 字号  像素 @modified '), { words: ['字号', '像素'], modified: true })
  assert.deepEqual(parseQuery(''), { words: [], modified: false })
})

test('标题、说明、键名与分类都参与匹配', () => {
  assert.equal(matchesSetting(SCHEMA[0], ['字号']), true)
  assert.equal(matchesSetting(SCHEMA[0], ['像素']), true)
  assert.equal(matchesSetting(SCHEMA[0], ['terminal']), true)
  assert.equal(matchesSetting(SCHEMA[0], ['字体']), true)
  assert.equal(matchesSetting(SCHEMA[0], ['配色']), false)
})

test('多个词要同时命中', () => {
  assert.equal(matchesSetting(SCHEMA[0], ['terminal', '字号']), true)
  assert.equal(matchesSetting(SCHEMA[0], ['terminal', '配色']), false)
})

test('只看已修改按脏键过滤', () => {
  const dirty = new Set(['editor.theme'])
  assert.deepEqual(
    filterSettings(SCHEMA, '', { dirty, onlyModified: true }).map((item) => item.key),
    ['editor.theme'],
  )
  // @modified 与开关等价；两者任一开启都过滤。
  assert.deepEqual(
    filterSettings(SCHEMA, '@modified', { dirty }).map((item) => item.key),
    ['editor.theme'],
  )
})

test('搜索与已修改一起用时取交集', () => {
  const dirty = new Set(['terminal.font_size', 'editor.theme'])
  assert.deepEqual(
    filterSettings(SCHEMA, 'terminal @modified', { dirty }).map((item) => item.key),
    ['terminal.font_size'],
  )
})

test('分组按首次出现排序，组内保持登记顺序', () => {
  const groups = groupSettings(SCHEMA)
  assert.deepEqual(groups.map((group) => group.title), ['终端', '编辑器', '顶栏'])
  assert.deepEqual(groups[0].items.map((item) => item.key), ['terminal.font_size', 'terminal.line_height'])
})

test('分类是否有修改', () => {
  const dirty = new Set(['header.metrics.cpu'])
  const groups = groupSettings(SCHEMA)
  assert.equal(groupModified(groups[0], dirty), false)
  assert.equal(groupModified(groups[2], dirty), true)
})

test('运行服务按三类动作筛选，未知类型按启动算', () => {
  const header = { runs: { start: true, package: false, install: true } }
  assert.equal(runTypeVisible(header, 'run'), true)
  assert.equal(runTypeVisible(header, 'build'), false)
  assert.equal(runTypeVisible(header, 'install'), true)
  assert.equal(runTypeVisible(header, 'unknown'), true)
  assert.equal(runTypeVisible({ runs: { start: false } }, 'anything'), false)
  // 设置还没加载完时按默认全显示。
  assert.equal(runTypeVisible(undefined, 'package'), true)
})
