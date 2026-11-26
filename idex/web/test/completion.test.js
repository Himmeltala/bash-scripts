/*
 * @Author: Himmeltala
 * @Date: 2026-11-26 09:26:41
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-26 09:26:41
 * @FilePath: \idex\web\test\completion.test.js
 * @Description: 补全选项与请求闸门的测试。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  completionAnchor,
  completionOptions,
  latestRequests,
  snapshotMatches,
  textEditChanges,
} from '../src/features/editor/core/completion.js'

test('补全项保留标签与文档', () => {
  const [item] = completionOptions([{ label: 'foo', detail: 'def foo()', documentation: '说明' }])
  assert.equal(item.label, 'foo')
  assert.equal(item.detail, 'def foo()')
  assert.equal(item.info, '说明')
})

test('带附加改动的补全项被丢弃', () => {
  const items = completionOptions([
    { label: 'keep' },
    { label: 'drop', additionalTextEdits: [{ newText: 'x' }] },
  ])
  assert.deepEqual(items.map((item) => item.label), ['keep'])
})

const textEditItem = {
  label: 'print',
  textEdit: {
    start: { line: 0, character: 2 },
    end: { line: 0, character: 4 },
    newText: 'print',
  },
}

test('textEdit 的 apply 按文档坐标替换', () => {
  const [item] = completionOptions([textEditItem], 'abcd\n')
  const changes = []
  item.apply({ state: { doc: { toString: () => 'abcd\n' } }, dispatch: (spec) => changes.push(spec.changes) }, null, 0, 0)
  assert.deepEqual(changes, [{ from: 2, to: 4, insert: 'print' }])
})

test('文档在补全请求后变过时退回当前词替换', () => {
  const [item] = completionOptions([textEditItem], 'old')
  const changes = []
  item.apply({ state: { doc: { toString: () => 'abcd\n' } }, dispatch: (spec) => changes.push(spec.changes) }, null, 1, 2)
  assert.deepEqual(changes, [{ from: 1, to: 2, insert: 'print' }])
})

test('补全锚点跳过成员访问与参数前缀', () => {
  assert.deepEqual(completionAnchor('obj.p', 5), {
    from: 4,
    empty: false,
    trigger: false,
    triggerChar: '.',
  })
  assert.deepEqual(completionAnchor('obj.', 4), {
    from: 4,
    empty: true,
    trigger: true,
    triggerChar: '.',
  })
  assert.deepEqual(completionAnchor('--fo', 4), {
    from: 2,
    empty: false,
    trigger: false,
    triggerChar: '-',
  })
  assert.deepEqual(completionAnchor('', 0), {
    from: 0,
    empty: true,
    trigger: false,
    triggerChar: '',
  })
  assert.deepEqual(completionAnchor('<', 1), {
    from: 1,
    empty: true,
    trigger: true,
    triggerChar: '<',
  })
  assert.deepEqual(completionAnchor('<di', 3), {
    from: 1,
    empty: false,
    trigger: false,
    triggerChar: '<',
  })
  assert.deepEqual(completionAnchor(':ms', 3), {
    from: 1,
    empty: false,
    trigger: false,
    triggerChar: ':',
  })
})

test('textEdit 变更拒绝旧文档与反区间', () => {
  const edit = textEditItem.textEdit
  assert.deepEqual(textEditChanges('abcd\n', 'abcd\n', edit, 'x'), {
    from: 2,
    to: 4,
    insert: 'print',
  })
  assert.equal(textEditChanges('old', 'abcd\n', edit, 'x'), null)
  assert.equal(
    textEditChanges(
      'abcd\n',
      'abcd\n',
      { ...edit, start: { line: 0, character: 4 }, end: { line: 0, character: 2 } },
      'x',
    ),
    null,
  )
})

test('文档快照比较', () => {
  assert.equal(snapshotMatches('abc', 'abc'), true)
  assert.equal(snapshotMatches('abc', 'abd'), false)
})

test('过期请求的结果被丢弃', async () => {
  const gate = latestRequests()
  const slow = gate.run(() => new Promise((resolve) => setTimeout(() => resolve('slow'), 20)))
  const fast = await gate.run(() => 'fast')
  assert.equal(fast, 'fast')
  assert.equal(await slow, undefined)
})

test('取消后已发出的请求不再落地', async () => {
  const gate = latestRequests()
  const slow = gate.run(() => new Promise((resolve) => setTimeout(() => resolve('slow'), 20)))
  gate.cancel()
  assert.equal(await slow, undefined)
})
