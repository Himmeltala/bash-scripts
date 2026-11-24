<!--
 * @Author: Himmeltala
 * @Date: 2026-11-24 23:05:28
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 23:09:46
 * @FilePath: \idex\web\src\features\settings\components\SettingsItem.vue
 * @Description: 设置项的统一样式：标题、右上动作、控件、控件下方的短说明。
-->
<template>
  <div class="item">
    <div class="head">
      <span class="label">{{ label }}</span>
      <slot name="action" />
    </div>
    <div class="control">
      <slot />
    </div>
    <p v-if="hint" class="hint">{{ hint }}</p>
  </div>
</template>

<script setup>
defineProps({
  label: { type: String, required: true },
  hint: { type: String, default: '' },
})
</script>

<style scoped>
.item {
  padding: 12px 0;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
.item:last-child {
  border-bottom: 0;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}
.label {
  font-size: 0.84rem;
  font-weight: 500;
}
.control {
  min-width: 0;
}
.hint {
  margin: 6px 0 0;
  font-size: 0.76rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
</style>
