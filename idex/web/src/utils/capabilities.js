// 设置页用一句话说明每种语言服务器的补全与格式化能力。

export function capabilityText(item) {
  if (!item) return ''
  if (item.id === 'vue') return '补全与格式化一期未接入'
  const caps = item.capabilities
  if (!caps) return ''
  return [
    caps.completion ? '支持补全' : '不支持补全',
    caps.formatting ? '支持格式化' : '不支持格式化',
  ].join('；')
}
