/*
 * @Author: Himmeltala
 * @Date: 2026-11-20 00:50:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-20 00:50:00
 * @FilePath: \dvcsx\web\test\logView.test.js
 * @Description: 提交列表的分支标签、推送状态与版本号显示。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { refsOf, revLabel, stateOf, tone } from '../src/composables/logView.js'

test('分支标签去重，head、tag、upstream 各给各的图标', () => {
  const marks = refsOf(
    {
      labels: [
        { name: 'main', kind: 'head' },
        { name: 'main', kind: 'head' },
        { name: 'v1.0', kind: 'tag' },
        { name: 'origin/main', kind: 'upstream' },
      ],
    },
    true,
    null
  )
  assert.deepEqual(
    marks.map((mark) => [mark.kind, mark.text]),
    [
      ['head', 'main'],
      ['tag', 'v1.0'],
      ['upstream', 'origin/main'],
    ]
  )
})

test('老服务端没有 labels 时用远端信息补 HEAD 与上游', () => {
  const marks = refsOf(
    { head: true, remote_tip: true },
    true,
    { branch: 'dev', upstream: 'origin/dev' }
  )
  assert.deepEqual(
    marks.map((mark) => mark.text),
    ['dev', 'origin/dev']
  )
  assert.deepEqual(refsOf({ head: true }, false, null), [])
})

test('推送状态按本地与远端位置给', () => {
  assert.equal(stateOf({ pushed: undefined }, true), null)
  assert.equal(stateOf({ pushed: true, local: true }, true), null)
  assert.equal(stateOf({ pushed: false, local: true }, true).text, '未推送')
  assert.equal(stateOf({ pushed: true, local: false }, true).text, '待拉取')
  assert.equal(stateOf({ local: false }, false).text, '待更新')
  assert.equal(stateOf({ local: true }, false), null)
})

test('Git 只显示七位，SVN 带 r 前缀', () => {
  assert.equal(revLabel('0123456789abcdef', true), '0123456')
  assert.equal(revLabel('12345', false), 'r12345')
})

test('文件动作配色由主题变量决定', () => {
  assert.equal(tone('A').startsWith('rgb(var(--v-theme-'), true)
})
