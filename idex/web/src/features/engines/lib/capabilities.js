/*
 * @Author: Himmeltala
 * @Date: 2026-11-26 09:26:41
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-26 09:26:41
 * @FilePath: \idex\web\src\features\engines\lib\capabilities.js
 * @Description: 语言服务器的补全与格式化能力文案。
 */
// 设置页用一句话说明每种语言服务器的补全与格式化能力。

export function capabilityText(item) {
  if (!item) return ''
  const caps = item.capabilities
  if (!caps) return ''
  return [
    caps.completion ? '支持补全' : '不支持补全',
    caps.formatting ? '支持格式化' : '不支持格式化',
  ].join('；')
}
