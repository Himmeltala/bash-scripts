<!--
 * @Author: Himmeltala
 * @Date: 2026-11-25 00:00:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-25 00:00:00
 * @FilePath: \idex\web\src\features\dock\components\DockItem.vue
 * @Description: Dock 上的一个入口：图标在上、文字在下。
-->
<template>
  <button type="button" class="dock-item" :title="label" @click="$emit('click', $event)">
    <span class="icon">
      <v-badge
        v-if="badge !== null && badge !== undefined && badge !== ''"
        :content="badge"
        :color="badgeColor"
      >
        <v-icon size="24">{{ icon }}</v-icon>
      </v-badge>
      <v-icon v-else size="24">{{ icon }}</v-icon>
    </span>
    <span class="label">{{ label }}</span>
  </button>
</template>

<script setup>
defineProps({
  label: { type: String, required: true },
  icon: { type: String, required: true },
  badge: { type: [Number, String], default: null },
  badgeColor: { type: String, default: 'primary' },
})
defineEmits(['click'])
</script>

<style scoped>
.dock-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 60px;
  padding: 4px 2px 3px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  font: inherit;
  cursor: pointer;
}
.dock-item:hover {
  background: rgba(var(--v-theme-on-surface), 0.08);
}
.icon {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 26px;
}
.label {
  max-width: 56px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 0.66rem;
  line-height: 1.2;
  color: rgb(var(--v-theme-on-surface-variant));
}
</style>
