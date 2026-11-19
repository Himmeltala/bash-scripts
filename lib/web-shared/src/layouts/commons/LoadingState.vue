<!--
 * @Author: Himmeltala
 * @Date: 2026-11-19 09:52:07
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-19 09:52:07
 * @FilePath: \lib\web-shared\src\layouts\commons\LoadingState.vue
 * @Description: 通用进行中状态：转圈加一句说明，占满调用方给的空间。
-->
<template>
  <div class="loading-state">
    <v-progress-circular indeterminate :size="size" :width="width" color="primary" />
    <p v-if="hint" class="loading-state-hint">{{ hint }}</p>
  </div>
</template>

<script setup>
defineProps({
  hint: { type: String, default: '正在加载…' },
  size: { type: Number, default: 36 },
  width: { type: Number, default: 3 },
})
</script>

<style scoped>
.loading-state {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px;
  text-align: center;
}
.loading-state-hint {
  margin: 0;
  font-size: 0.84rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
</style>
