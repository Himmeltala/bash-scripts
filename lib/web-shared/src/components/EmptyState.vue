<template>
  <div class="empty-state" :style="{ '--empty-hint-width': `${hintWidth}px` }">
    <v-icon size="56" color="on-surface-variant">{{ icon }}</v-icon>
    <p v-if="title" class="empty-state-title">{{ title }}</p>
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
  title: { type: String, default: '' },
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
.empty-state-hint {
  color: rgb(var(--v-theme-on-surface-variant));
  max-width: var(--empty-hint-width);
  margin: 0 0 12px;
}
</style>
