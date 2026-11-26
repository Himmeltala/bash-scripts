<!--
 * @Author: Himmeltala
 * @Date: 2026-11-26 10:26:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-26 17:05:00
 * @FilePath: \idex\web\src\features\terminal\components\TerminalGroups.vue
 * @Description: Dock 标题栏里的工作区终端分组：点一组只看那组终端，不切工作区。
-->
<template>
  <div class="groups">
    <v-chip
      v-for="row in rows"
      :key="row.wsId"
      size="x-small"
      :variant="row.wsId === store.viewWsId ? 'flat' : 'text'"
      :color="row.wsId === store.viewWsId ? 'primary' : undefined"
      :title="row.wsId === current ? '当前工作区' : '只看这一组终端，不切换工作区'"
      @click="store.setView(row.wsId)"
    >
      {{ row.name }} {{ row.count }}
    </v-chip>
    <v-btn
      icon="mdi-plus"
      size="x-small"
      variant="text"
      title="在当前工作区新建终端"
      :disabled="!current"
      @click="store.createSlot(current)"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useTerminalsStore } from '../../../stores/terminals'
import { groupRows } from '../lib/groups'

const props = defineProps({
  workspaces: { type: Array, default: () => [] },
  current: { type: String, default: '' },
})

const store = useTerminalsStore()
const rows = computed(() => groupRows(store.groups, props.workspaces))
</script>

<style scoped>
.groups {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  overflow-x: auto;
}
.groups :deep(.v-chip) {
  flex: 0 0 auto;
}
</style>
