// 图表共用的小工具：统一字体与十六进制颜色的透明度换算。

export const CHART_FONT = 'Roboto, sans-serif'

// 图上角的小标题，三张图用同一套字号与位置。
export function chartTitle(title, skin) {
  if (!title) return undefined
  return {
    text: title,
    left: 12,
    top: 6,
    textStyle: { color: skin['on-surface'], fontSize: 13, fontWeight: 600, fontFamily: CHART_FONT },
  }
}

export function fadeColor(color, alpha) {
  const text = String(color || '')
  if (!text.startsWith('#')) return text
  let hex = text.slice(1)
  if (hex.length === 3) hex = hex.split('').map((ch) => ch + ch).join('')
  if (!/^[0-9a-f]{6}$/i.test(hex)) return text
  const value = Number.parseInt(hex, 16)
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`
}
