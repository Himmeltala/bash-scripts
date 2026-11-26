/*
 * @Author: Himmeltala
 * @Date: 2026-11-26 16:20:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-26 16:20:00
 * @FilePath: \lib\web-shared\src\utils\commons\animation.js
 * @Description: 全局动画方案：预设、速度倍率，以及换算成 CSS 变量的取值。
 */

export const ANIMATION_PRESETS = [
  { id: 'none', title: '无动画', duration: 0, ease: 'linear' },
  { id: 'quick', title: '迅速', duration: 120, ease: 'cubic-bezier(0.2, 0, 0, 1)' },
  { id: 'standard', title: '标准', duration: 220, ease: 'cubic-bezier(0.2, 0, 0, 1)' },
  { id: 'spring', title: '弹性', duration: 320, ease: 'cubic-bezier(0.34, 1.4, 0.64, 1)' },
  { id: 'soft', title: '柔和', duration: 420, ease: 'cubic-bezier(0.22, 0.61, 0.36, 1)' },
]

export const ANIMATION_DEFAULTS = { preset: 'standard', speed: 1 }

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

// 返回要写到根节点上的 CSS 变量；fast 用于退场这种该更快的场合。
export function animationVars(settings) {
  const value = { ...ANIMATION_DEFAULTS, ...(settings || {}) }
  const preset = ANIMATION_PRESETS.find((item) => item.id === value.preset) || ANIMATION_PRESETS[2]
  const speed = clamp(Number(value.speed) || 1, 0.5, 2)
  const duration = Math.round(preset.duration / speed)
  return {
    '--bash-anim-dur': `${duration}ms`,
    '--bash-anim-dur-fast': `${Math.round(duration * 0.6)}ms`,
    '--bash-anim-ease': preset.ease,
  }
}

// 把 CSS 变量里的时长文本换成 motion 要的秒数；读不出来当 0，也就是不动。
export function parseTime(text) {
  const value = String(text || '').trim()
  const ms = /^([\d.]+)ms$/.exec(value)
  if (ms) return Number(ms[1]) / 1000
  const sec = /^([\d.]+)s$/.exec(value)
  if (sec) return Number(sec[1])
  return 0
}

// 把 CSS 缓动换成 motion 的写法：cubic-bezier 拆成数组，几个关键字直接映射。
export function parseEase(text) {
  const value = String(text || '').trim()
  const bezier = /cubic-bezier\(([^)]+)\)/.exec(value)
  if (bezier) return bezier[1].split(',').map((part) => Number(part.trim()))
  const named = { linear: 'linear', 'ease-in': 'easeIn', 'ease-out': 'easeOut', 'ease-in-out': 'easeInOut' }
  return named[value] || 'easeOut'
}

// 写进根节点，样式里统一读这几个变量。没有 document 的环境（测试）直接跳过。
export function applyAnimation(settings, root) {
  const target = root || (typeof document === 'undefined' ? null : document.documentElement)
  if (!target) return
  const vars = animationVars(settings)
  for (const [key, value] of Object.entries(vars)) target.style.setProperty(key, value)
}
