<!--
 * @Author: Himmeltala
 * @Date: 2026-11-26 10:26:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-26 18:40:00
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
      @contextmenu.prevent.stop="openMenu(row, $event)"
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

  <ContextMenu
    v-model="menu.open"
    :x="menu.x"
    :y="menu.y"
    :items="MENU_ITEMS"
    @select="onAction"
  />

  <FloatingDialog
    v-model="rename.on"
    :initial-width="460"
    :initial-height="260"
    :min-width="360"
    :min-height="200"
  >
    <template #title>重命名工作区</template>
    <v-text-field
      v-model="rename.text"
      label="名称"
      density="compact"
      variant="outlined"
      maxlength="80"
      autofocus
      @keyup.enter="saveRename"
    />
    <template #actions>
      <v-spacer />
      <v-btn variant="text" @click="rename.on = false">取消</v-btn>
      <v-btn color="primary" variant="flat" :disabled="!rename.text.trim()" @click="saveRename">
        保存
      </v-btn>
    </template>
  </FloatingDialog>
</template>

<script setup>
import { computed, reactive } from 'vue'
import { ContextMenu, FloatingDialog } from '@bash-scripts/web-shared/feedbacks'
import { useTerminalsStore } from '../../../stores/terminals'
import { groupRows } from '../lib/groups'

const props = defineProps({
  workspaces: { type: Array, default: () => [] },
  current: { type: String, default: '' },
})

const store = useTerminalsStore()
const MENU_ITEMS = [{ action: 'rename', label: '重命名工作区', icon: 'mdi-rename-box' }]
const menu = reactive({ open: false, x: 0, y: 0, wsId: '' })
const rename = reactive({ on: false, wsId: '', text: '' })
const rows = computed(() => groupRows(store.groups, props.workspaces, store.groupNames))

function openMenu(row, event) {
  menu.wsId = row.wsId
  menu.x = event.clientX
  menu.y = event.clientY
  menu.open = true
}

function onAction(action) {
  if (action !== 'rename') return
  const row = rows.value.find((item) => item.wsId === menu.wsId)
  rename.wsId = menu.wsId
  rename.text = row?.name || ''
  rename.on = true
}

function saveRename() {
  const text = (rename.text || '').trim()
  if (!text || !rename.wsId) return
  store.renameGroup(rename.wsId, text)
  rename.on = false
}
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
