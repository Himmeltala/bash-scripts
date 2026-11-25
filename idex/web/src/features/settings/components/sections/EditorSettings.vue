<!--
 * @Author: Himmeltala
 * @Date: 2026-11-24 23:05:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-25 08:21:53
 * @FilePath: \idex\web\src\features\settings\components\sections\EditorSettings.vue
 * @Description: 编辑器设置：代码配色与代码地图，存服务端，保存后全局生效。
-->
<template>
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
import { onMounted, ref } from 'vue'
import { EDITOR_THEME_OPTIONS } from '../../../editor/core/themeOptions'
import { usePreferencesStore } from '../../../../stores/preferences'
import { api } from '../../../../utils/api'
import { toast } from '../../../../utils/notice'
import SettingsItem from '../SettingsItem.vue'

const preferences = usePreferencesStore()
const themeItems = EDITOR_THEME_OPTIONS.map((item) => ({ title: item.title, value: item.id }))
const theme = ref('auto')
const minimap = ref(false)
const defaults = ref({ editor_theme: 'auto', minimap: false })

function applyTheme(value) {
  preferences.editorTheme = value
}

async function load() {
  const data = await api.settings()
  defaults.value = data.defaults || defaults.value
  theme.value = data.editor_theme || defaults.value.editor_theme
  minimap.value = !!data.minimap
  preferences.minimap = minimap.value
  applyTheme(theme.value)
}

function reset() {
  theme.value = defaults.value.editor_theme
  minimap.value = !!defaults.value.minimap
  preferences.minimap = minimap.value
  applyTheme(theme.value)
}

async function save() {
  try {
    await api.saveSettings({
      editor_theme: theme.value,
      minimap: minimap.value,
    })
    preferences.minimap = minimap.value
    return true
  } catch (err) {
    toast(`保存编辑器设置失败：${err.message}`, 'error')
    return false
  }
}

onMounted(load)

defineExpose({ save, reset })
</script>
