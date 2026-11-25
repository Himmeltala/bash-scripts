/*
 * @Author: Himmeltala
 * @Date: 2026-11-25 10:00:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-25 10:00:00
 * @FilePath: \idex\web\test\mergeDiff.test.js
 * @Description: 合并差异编辑器的模式选项：并排/内联、折叠、可写状态。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeViewOptions, unifiedOptions } from '../src/features/editor/core/mergeDiff.js'

test('并排模式按可写状态给还原方向，只改动时折叠未变区域', () => {
  assert.deepEqual(mergeViewOptions({ collapse: true, writable: true }), {
    revertControls: 'a-to-b',
    collapseUnchanged: { margin: 3 },
  })
  assert.deepEqual(mergeViewOptions({ collapse: false, writable: false }), {
    revertControls: undefined,
    collapseUnchanged: undefined,
  })
})

test('内联模式带原始文档与接受/拒绝控件，折叠参数一致', () => {
  const options = unifiedOptions({ collapse: true, writable: true })
  assert.deepEqual(options, {
    mergeControls: true,
    collapseUnchanged: { margin: 3 },
    highlightChanges: true,
  })
  assert.deepEqual(unifiedOptions({ collapse: false, writable: false }), {
    mergeControls: false,
    collapseUnchanged: undefined,
    highlightChanges: true,
  })
})
