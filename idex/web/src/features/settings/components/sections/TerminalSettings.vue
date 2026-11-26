<!--
 * @Author: Himmeltala
 * @Date: 2026-11-26 11:55:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-26 14:00:00
 * @FilePath: \idex\web\src\features\settings\components\sections\TerminalSettings.vue
 * @Description: 终端设置：字体、字号、行高、字重、字间距、光标与回滚行数，全部直接填，存服务端。
-->
<template>
  <SettingsItem label="字体" hint="跟 CSS 的 font-family 一样，逗号分隔字体名；留空用应用默认等宽字体。">
    <v-text-field
      v-model="form.font_family"
      placeholder="'Fira Code', 'Noto Sans SC', monospace"
      density="compact"
      variant="outlined"
      hide-details
    />
  </SettingsItem>
  <SettingsItem label="字号" hint="像素值，任意数字。">
    <v-text-field
      v-model.number="form.font_size"
      type="number"
      density="compact"
      variant="outlined"
      hide-details
      class="num"
    />
  </SettingsItem>
  <SettingsItem label="行高" hint="倍数，例如 1.15。">
    <v-text-field
      v-model.number="form.line_height"
      type="number"
      step="0.05"
      density="compact"
      variant="outlined"
      hide-details
      class="num"
    />
  </SettingsItem>
  <SettingsItem label="字重">
    <v-select
      v-model="form.font_weight"
      :items="WEIGHT_CHOICES"
      density="compact"
      variant="outlined"
      hide-details
      class="num"
    />
  </SettingsItem>
  <SettingsItem label="字间距" hint="像素，可为负数；中文与符号挤在一起时加一点。">
    <v-text-field
      v-model.number="form.letter_spacing"
      type="number"
      step="0.5"
      density="compact"
      variant="outlined"
      hide-details
      class="num"
    />
  </SettingsItem>
  <SettingsItem label="光标样式">
    <v-select
      v-model="form.cursor_style"
      :items="CURSOR_CHOICES"
      density="compact"
      variant="outlined"
      hide-details
      class="num"
    />
  </SettingsItem>
  <SettingsItem label="光标闪烁">
    <v-switch
      v-model="form.cursor_blink"
      color="primary"
      density="compact"
      hide-details
      inset
    />
  </SettingsItem>
  <SettingsItem label="回滚行数" hint="终端能往回翻多少行，范围 1000–100000。">
    <v-text-field
      v-model.number="form.scrollback"
      type="number"
      density="compact"
      variant="outlined"
      hide-details
      class="num"
    />
  </SettingsItem>
</template>

<script setup>
import { onMounted, reactive, ref, watch } from 'vue'
import { usePreferencesStore } from '../../../../stores/preferences'
import { TERMINAL_DEFAULTS } from '../../../terminal/lib/options'
import { api } from '../../../../utils/api'
import { toast } from '../../../../utils/notice'
import SettingsItem from '../SettingsItem.vue'

const WEIGHT_CHOICES = [
  { title: '常规', value: 'normal' },
  { title: '中等', value: '500' },
  { title: '加粗', value: 'bold' },
]
const CURSOR_CHOICES = [
  { title: '方块', value: 'block' },
  { title: '竖线', value: 'bar' },
  { title: '下划线', value: 'underline' },
]

const preferences = usePreferencesStore()
const form = reactive({ ...TERMINAL_DEFAULTS })
const defaults = ref({ ...TERMINAL_DEFAULTS })

// 改一项就先预览：写进偏好，已打开的 xterm 会立刻跟着变。
watch(form, () => {
  preferences.terminal = { ...form, font_family: form.font_family || '' }
})

async function load() {
  const data = await api.settings()
  defaults.value = data.defaults?.terminal || defaults.value
  Object.assign(form, defaults.value, data.terminal || {})
  preferences.terminal = { ...form }
}

function reset() {
  Object.assign(form, defaults.value)
}

async function save() {
  try {
    await api.saveSettings({ terminal: { ...form } })
    preferences.terminal = { ...form }
    return true
  } catch (err) {
    toast(`保存终端设置失败：${err.message}`, 'error')
    return false
  }
}

onMounted(load)

defineExpose({ save, reset })
</script>

<style scoped>
.num {
  max-width: 220px;
}
</style>
