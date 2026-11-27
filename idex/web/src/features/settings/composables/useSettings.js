/*
 * @Author: Himmeltala
 * @Date: 2026-11-28 10:12:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-28 10:12:00
 * @FilePath: \idex\web\src\features\settings\composables\useSettings.js
 * @Description: 设置的领域投影：把扁平键组装成组件要的形状，组件不拼键、不合并默认值。
 */

import { computed } from 'vue'
import { ANIMATION_DEFAULTS } from '@bash-scripts/web-shared'
import { useSettingsStore } from '../../../stores/settings'
import { TERMINAL_DEFAULTS } from '../../terminal/lib/options'
import { EDITOR_FONT_FALLBACK } from '../../editor/core/fonts'
import { SHORTCUT_DEFAULTS } from '../lib/shortcuts'
import { HEADER_DEFAULTS } from '../lib/runTypes'

// 设置加载完之前返回登记前的回退值，界面不会闪成空。
function valueOf(settings, key, fallback) {
  const value = settings.get(key)
  return value === undefined ? fallback : value
}

function boolOf(settings, key, fallback) {
  return valueOf(settings, key, fallback) !== false
}

export function useShortcutBindings() {
  const settings = useSettingsStore()
  return computed(() => ({ ...SHORTCUT_DEFAULTS, ...(valueOf(settings, 'shortcuts', {}) || {}) }))
}

export function useTerminalSettings() {
  const settings = useSettingsStore()
  return computed(() => ({
    font_family: valueOf(settings, 'terminal.font_family', TERMINAL_DEFAULTS.font_family),
    font_size: valueOf(settings, 'terminal.font_size', TERMINAL_DEFAULTS.font_size),
    line_height: valueOf(settings, 'terminal.line_height', TERMINAL_DEFAULTS.line_height),
    font_weight: valueOf(settings, 'terminal.font_weight', TERMINAL_DEFAULTS.font_weight),
    letter_spacing: valueOf(settings, 'terminal.letter_spacing', TERMINAL_DEFAULTS.letter_spacing),
    cursor_style: valueOf(settings, 'terminal.cursor_style', TERMINAL_DEFAULTS.cursor_style),
    cursor_blink: valueOf(settings, 'terminal.cursor_blink', TERMINAL_DEFAULTS.cursor_blink),
    scrollback: valueOf(settings, 'terminal.scrollback', TERMINAL_DEFAULTS.scrollback),
  }))
}

export function useEditorSettings() {
  const settings = useSettingsStore()
  return computed(() => ({
    font: {
      font_family: valueOf(settings, 'editor.font_family', EDITOR_FONT_FALLBACK.font_family),
      font_size: valueOf(settings, 'editor.font_size', EDITOR_FONT_FALLBACK.font_size),
      line_height: valueOf(settings, 'editor.line_height', EDITOR_FONT_FALLBACK.line_height),
      font_weight: valueOf(settings, 'editor.font_weight', EDITOR_FONT_FALLBACK.font_weight),
      letter_spacing: valueOf(settings, 'editor.letter_spacing', EDITOR_FONT_FALLBACK.letter_spacing),
    },
    theme: valueOf(settings, 'editor.theme', 'auto'),
    minimap: boolOf(settings, 'editor.minimap', false),
    minimapOpacity: valueOf(settings, 'editor.minimap_opacity', 0),
  }))
}

export function useHeaderSettings() {
  const settings = useSettingsStore()
  return computed(() => {
    const metrics = {}
    for (const key of Object.keys(HEADER_DEFAULTS.metrics)) {
      metrics[key] = boolOf(settings, `header.metrics.${key}`, true)
    }
    const runs = {}
    for (const key of Object.keys(HEADER_DEFAULTS.runs)) {
      runs[key] = boolOf(settings, `header.runs.${key}`, true)
    }
    return {
      metrics,
      runs,
      services: boolOf(settings, 'header.services', true),
      recent: boolOf(settings, 'header.recent', true),
      theme: boolOf(settings, 'header.theme', true),
    }
  })
}

export function useAnimationSettings() {
  const settings = useSettingsStore()
  return computed(() => ({
    preset: valueOf(settings, 'animation.preset', ANIMATION_DEFAULTS.preset),
    speed: valueOf(settings, 'animation.speed', ANIMATION_DEFAULTS.speed),
  }))
}
