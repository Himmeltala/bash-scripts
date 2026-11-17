<!--
 * @Author: Himmeltala
 * @Date: 2026-11-17 00:15:49
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-17 23:24:00
 * @FilePath: \lib\web-shared\src\layouts\commons\EmptyState.vue
 * @Description: 通用空状态：图标、标题、路径、说明与操作按钮。
-->
<template>
  <div class="empty-state" :style="{ '--empty-hint-width': `${hintWidth}px` }">
    <v-icon :size="iconSize" color="on-surface-variant">{{ icon }}</v-icon>
    <p v-if="title" class="empty-state-title">{{ title }}</p>
    <div v-if="path" class="empty-state-path mono" :title="path">{{ path }}</div>
    <p v-if="hint" class="empty-state-hint">{{ hint }}</p>
    <slot name="actions">
      <v-btn
        v-if="action"
        color="primary"
        variant="flat"
        :prepend-icon="actionIcon"
        @click="$emit('action')"
      >
        {{ action }}
      </v-btn>
    </slot>
    <slot />
  </div>
</template>

<script setup>
defineProps({
  icon: { type: String, default: 'mdi-view-dashboard-outline' },
  iconSize: { type: Number, default: 56 },
  title: { type: String, default: '' },
  // 要显示具体路径的场合（大文件、读不了的文件）：等宽字体单独一行，长路径能折行。
  path: { type: String, default: '' },
  hint: { type: String, default: '' },
  action: { type: String, default: '' },
  actionIcon: { type: String, default: 'mdi-folder-plus' },
  hintWidth: { type: Number, default: 460 },
})

defineEmits(['action'])
</script>

<style scoped>
.empty-state {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-align: center;
  padding: 24px;
}
.empty-state-title {
  font-size: 1.1rem;
  margin: 8px 0 0;
}
.empty-state-path {
  max-width: 40rem;
  font-size: 0.84rem;
  word-break: break-all;
}
.empty-state-hint {
  color: rgb(var(--v-theme-on-surface-variant));
  max-width: var(--empty-hint-width);
  margin: 0 0 12px;
}
</style>
