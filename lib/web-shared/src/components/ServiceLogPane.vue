<template>
  <div class="log-head">
    <span class="label">日志</span>
    <v-spacer />
    <v-btn v-if="more" size="small" variant="text" prepend-icon="mdi-history" @click="$emit('load-more')">
      更早
    </v-btn>
  </div>
  <div class="log-box">
    <LogView v-if="text" :text="text" :dark="dark" :colorize="colorize" />
    <p v-else class="log-empty">{{ emptyText }}</p>
  </div>
</template>

<script setup>
import LogView from './LogView.vue'

defineProps({
  text: { type: String, default: '' },
  more: { type: Boolean, default: false },
  dark: { type: Boolean, default: false },
  // 行着色规则由各工具给：nodex 认 npm，mvnx 认 Maven。
  colorize: { type: Function, default: (text) => text },
  emptyText: { type: String, default: '还没有运行过' },
})

defineEmits(['load-more'])
</script>

<style scoped>
.log-head {
  display: flex;
  align-items: center;
  margin-bottom: 6px;
}
.log-box {
  display: flex;
  flex: 1 1 auto;
  min-height: 200px;
}
.log-box > * {
  flex: 1 1 auto;
  min-width: 0;
}
.label {
  font-size: 0.78rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.log-empty {
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.86rem;
}
</style>
