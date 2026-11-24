<!--
 * @Author: Himmeltala
 * @Date: 2026-11-24 23:05:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 23:09:46
 * @FilePath: \idex\web\src\features\settings\components\sections\EditorSettings.vue
 * @Description: 编辑器设置：代码配色，存在浏览器本地，改完立即生效。
-->
<template>
  <SettingsItem label="代码配色" hint="只保存在当前浏览器，选中即生效。">
    <v-select
      :model-value="preferences.editorTheme"
      :items="themeItems"
      item-title="title"
      item-value="value"
      density="compact"
      variant="outlined"
      hide-details
      @update:model-value="preferences.editorTheme = $event"
    />
  </SettingsItem>
</template>

<script setup>
import { EDITOR_THEME_OPTIONS } from '../../../editor/core/themeOptions'
import { usePreferencesStore } from '../../../../stores/preferences'
import SettingsItem from '../SettingsItem.vue'

const preferences = usePreferencesStore()
const themeItems = EDITOR_THEME_OPTIONS.map((item) => ({ title: item.title, value: item.id }))

function reset() {
  preferences.editorTheme = 'auto'
}

defineExpose({ reset })
</script>
