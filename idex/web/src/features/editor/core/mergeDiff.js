/*
 * @Author: Himmeltala
 * @Date: 2026-11-25 10:00:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-25 10:00:00
 * @FilePath: \idex\web\src\features\editor\core\mergeDiff.js
 * @Description: 合并差异编辑器的模式选项，纯函数便于测试。
 */

export function mergeViewOptions({ collapse, writable }) {
  return {
    // 只读差异不显示块还原按钮；可写时把左侧原文还原到右侧工作副本。
    revertControls: writable ? 'a-to-b' : undefined,
    collapseUnchanged: collapse ? { margin: 3 } : undefined,
  }
}

export function unifiedOptions({ collapse, writable }) {
  return {
    mergeControls: writable,
    collapseUnchanged: collapse ? { margin: 3 } : undefined,
    highlightChanges: true,
  }
}
