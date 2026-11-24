<!--
 * @Author: Himmeltala
 * @Date: 2026-11-24 23:05:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 23:01:03
 * @FilePath: \idex\web\src\features\settings\components\sections\EditorSettings.vue
 * @Description: 编辑器设置：代码配色，存在浏览器本地，改完立即生效。
-->
<template>
  <h3 class="pane-title">编辑器</h3>
  <div class="field">
    <span class="field-label">代码配色</span>
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
    <p class="hint">只保存在当前浏览器，与界面深浅色互不影响，选中即生效。</p>
  </div>
</template>

<script setup>
import { EDITOR_THEME_OPTIONS } from '../../../editor/core/themeOptions'
import { usePreferencesStore } from '../../../../stores/preferences'

const preferences = usePreferencesStore()
const themeItems = EDITOR_THEME_OPTIONS.map((item) => ({ title: item.title, value: item.id }))
</script>

<style scoped>
.pane-title {
  margin: 0 0 12px;
  font-size: 0.95rem;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field-label {
  font-size: 0.84rem;
  font-weight: 500;
}
.hint {
  margin: 0;
  font-size: 0.76rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
</style>
