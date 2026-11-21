// 图表共用的小工具：统一字体与十六进制颜色的透明度换算。

export const CHART_FONT = 'Roboto, sans-serif'

export function fadeColor(color, alpha) {
  const text = String(color || '')
  if (!text.startsWith('#')) return text
  let hex = text.slice(1)
  if (hex.length === 3) hex = hex.split('').map((ch) => ch + ch).join('')
  if (!/^[0-9a-f]{6}$/i.test(hex)) return text
  const value = Number.parseInt(hex, 16)
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`
}
