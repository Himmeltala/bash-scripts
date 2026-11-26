// 动画方案换算成 CSS 变量：时长按速度缩放，缓动按方案换。
import test from 'node:test'
import assert from 'node:assert/strict'
import { ANIMATION_DEFAULTS, ANIMATION_PRESETS, animationVars, parseEase, parseTime } from '../src/utils/commons/animation.js'

test('默认方案是标准速度', () => {
  const vars = animationVars({})
  assert.equal(vars['--bash-anim-dur'], '220ms')
  assert.equal(vars['--bash-anim-dur-fast'], '132ms')
  assert.equal(vars['--bash-anim-ease'], 'cubic-bezier(0.2, 0, 0, 1)')
  assert.equal(ANIMATION_DEFAULTS.preset, 'standard')
})

test('速度 2 倍时时长减半', () => {
  assert.equal(animationVars({ preset: 'standard', speed: 2 })['--bash-anim-dur'], '110ms')
})

test('无动画方案时长归零', () => {
  const vars = animationVars({ preset: 'none' })
  assert.equal(vars['--bash-anim-dur'], '0ms')
  assert.equal(vars['--bash-anim-dur-fast'], '0ms')
})

test('未知方案退回标准，速度钳在 0.5–2', () => {
  assert.equal(animationVars({ preset: '不存在' })['--bash-anim-dur'], '220ms')
  assert.equal(animationVars({ preset: 'standard', speed: 9 })['--bash-anim-dur'], '110ms')
  assert.equal(animationVars({ preset: 'standard', speed: 0.1 })['--bash-anim-dur'], '440ms')
})

test('每个方案都有标题与缓动', () => {
  for (const preset of ANIMATION_PRESETS) {
    assert.ok(preset.id && preset.title && preset.ease)
  }
})

test('时长文本换成秒', () => {
  assert.equal(parseTime('220ms'), 0.22)
  assert.equal(parseTime('0ms'), 0)
  assert.equal(parseTime('1.5s'), 1.5)
  assert.equal(parseTime('坏了'), 0)
})

test('缓动文本换成 motion 认的写法', () => {
  assert.deepEqual(parseEase('cubic-bezier(0.2, 0, 0, 1)'), [0.2, 0, 0, 1])
  assert.equal(parseEase('linear'), 'linear')
  assert.equal(parseEase('ease-in-out'), 'easeInOut')
  assert.equal(parseEase('随便写'), 'easeOut')
})
