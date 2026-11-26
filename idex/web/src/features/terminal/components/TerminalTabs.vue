<!--
 * @Author: Himmeltala
 * @Date: 2026-11-25 00:00:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-26 18:40:00
 * @FilePath: \idex\web\src\features\terminal\components\TerminalTabs.vue
 * @Description: 终端面板的标签栏：切换、新建与关闭。
-->
<template>
  <div class="tabs">
    <button
      v-for="item in items"
      :key="item.key"
      type="button"
      class="tab"
      :class="{ active: item.key === activeKey, exited: item.status === 'exited' }"
      :title="item.title"
      @click="$emit('select', item.key)"
      @contextmenu.prevent.stop="$emit('menu', { item, event: $event })"
    >
      <v-icon size="13">mdi-console-line</v-icon>
      <span class="name">{{ item.title || '终端' }}</span>
    </button>
    <v-btn
      icon="mdi-plus"
      size="x-small"
      variant="text"
      title="新建终端"
      @click="$emit('create')"
    />
  </div>
</template>

<script setup>
defineProps({
  items: { type: Array, default: () => [] },
  activeKey: { type: String, default: '' },
})
// 关闭只走右键菜单，标签上不放删除按钮，免得点错。
defineEmits(['select', 'create', 'menu'])
</script>

<style scoped>
.tabs {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
  overflow-x: auto;
}
.tab {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 180px;
  padding: 2px 5px 2px 8px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: rgb(var(--v-theme-on-surface-variant));
  font: inherit;
  font-size: 0.76rem;
  cursor: pointer;
}
.tab:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
}
.tab.active {
  background: rgba(var(--v-theme-primary), 0.14);
  color: rgb(var(--v-theme-on-surface));
}
.tab.exited .name {
  text-decoration: line-through;
  opacity: 0.7;
}
.name {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
