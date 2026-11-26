<!--
 * @Author: Himmeltala
 * @Date: 2026-11-24 23:05:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-26 23:30:00
 * @FilePath: \idex\web\src\features\settings\components\sections\EditorSettings.vue
 * @Description: 编辑器设置：字体、代码配色与代码地图，存服务端，保存后全局生效。
-->
<template>
  <SettingsItem label="字体" hint="跟 CSS 的 font-family 一样，逗号分隔字体名；只影响编辑器，不影响终端。">
    <v-text-field
      v-model="font.font_family"
      placeholder="'Fira Code', 'Noto Sans SC', monospace"
      density="compact"
      variant="outlined"
      hide-details
    />
  </SettingsItem>
  <SettingsItem label="字号" hint="像素值，任意数字。">
    <v-text-field
      v-model.number="font.font_size"
      type="number"
      density="compact"
      variant="outlined"
      hide-details
      class="num"
    />
  </SettingsItem>
  <SettingsItem label="行高" hint="倍数，例如 1.6。">
    <v-text-field
      v-model.number="font.line_height"
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
      v-model="font.font_weight"
      :items="WEIGHT_CHOICES"
      density="compact"
      variant="outlined"
      hide-details
      class="num"
    />
  </SettingsItem>
  <SettingsItem label="字间距" hint="像素，可为负数；中文与符号挤在一起时加一点。">
    <v-text-field
      v-model.number="font.letter_spacing"
      type="number"
      step="0.5"
      density="compact"
      variant="outlined"
      hide-details
      class="num"
    />
  </SettingsItem>
  <SettingsItem label="代码配色" hint="选中即预览，保存后下次打开仍沿用。">
    <v-select
      v-model="theme"
      :items="themeItems"
      item-title="title"
      item-value="value"
      density="compact"
      variant="outlined"
      hide-details
      @update:model-value="applyTheme"
    />
  </SettingsItem>
  <SettingsItem label="代码地图" hint="在编辑器右侧显示当前文件的缩略图，点击可快速跳转。">
    <v-switch
      v-model="minimap"
      color="primary"
      density="compact"
      hide-details
      inset
    />
  </SettingsItem>
</template>

<script setup>
import { onMounted, reactive, ref, watch } from 'vue'
import { EDITOR_THEME_OPTIONS } from '../../../editor/core/themeOptions'
import { EDITOR_FONT_FALLBACK, applyEditorFont } from '../../../editor/core/fonts'
import { usePreferencesStore } from '../../../../stores/preferences'
import { api } from '../../../../utils/api'
import { toast } from '../../../../utils/notice'
import SettingsItem from '../SettingsItem.vue'

const WEIGHT_CHOICES = [
  { title: '常规', value: 'normal' },
  { title: '中等', value: '500' },
  { title: '加粗', value: 'bold' },
]

const preferences = usePreferencesStore()
const themeItems = EDITOR_THEME_OPTIONS.map((item) => ({ title: item.title, value: item.id }))
const theme = ref('auto')
const minimap = ref(false)
const font = reactive({ ...EDITOR_FONT_FALLBACK })
const defaults = ref({ editor_theme: 'auto', minimap: false, editor_font: { ...EDITOR_FONT_FALLBACK } })

function applyTheme(value) {
  preferences.editorTheme = value
}

// 改一项就先预览：写到根节点变量上，已打开的 CodeMirror 立刻跟着变。
watch(font, () => {
  preferences.editorFont = { ...font }
  applyEditorFont(font)
})

async function load() {
  const data = await api.settings()
  defaults.value = {
    editor_theme: data.defaults?.editor_theme || 'auto',
    minimap: !!data.defaults?.minimap,
    editor_font: { ...EDITOR_FONT_FALLBACK, ...(data.defaults?.editor_font || {}) },
  }
  theme.value = data.editor_theme || defaults.value.editor_theme
  minimap.value = !!data.minimap
  Object.assign(font, defaults.value.editor_font, data.editor_font || {})
  preferences.minimap = minimap.value
  applyTheme(theme.value)
}

function reset() {
  theme.value = defaults.value.editor_theme
  minimap.value = !!defaults.value.minimap
  Object.assign(font, defaults.value.editor_font)
  preferences.minimap = minimap.value
  applyTheme(theme.value)
}

async function save() {
  try {
    await api.saveSettings({
      editor_theme: theme.value,
      minimap: minimap.value,
      editor_font: { ...font },
    })
    preferences.minimap = minimap.value
    preferences.editorFont = { ...font }
    applyEditorFont(font)
    return true
  } catch (err) {
    toast(`保存编辑器设置失败：${err.message}`, 'error')
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
