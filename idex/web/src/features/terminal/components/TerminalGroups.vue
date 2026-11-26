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
    <v-tabs
      :model-value="store.viewWsId"
      density="compact"
      color="primary"
      show-arrows
      class="group-tabs"
      @update:model-value="store.setView"
    >
      <v-tab
        v-for="row in rows"
        :key="row.wsId"
        :value="row.wsId"
        :title="row.wsId === current ? '当前工作区' : '只看这一组终端，不切换工作区'"
        @contextmenu.prevent.stop="openMenu(row, $event)"
      >
        {{ row.name }}
        <span class="count">{{ row.count }}</span>
      </v-tab>
    </v-tabs>
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

  <FloatingDialog
    v-model="remove.on"
    :initial-width="460"
    :initial-height="220"
    :min-width="360"
    :min-height="180"
  >
    <template #title>移除工作区终端</template>
    <p class="remove-text">
      关掉「{{ remove.name }}」的全部 {{ remove.count }} 个终端，并从分组里移除。工作副本本身不动。
    </p>
    <template #actions>
      <v-spacer />
      <v-btn variant="text" @click="remove.on = false">取消</v-btn>
      <v-btn color="error" variant="flat" @click="confirmRemove">移除</v-btn>
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

const emit = defineEmits(['close-dock'])

const store = useTerminalsStore()
const MENU_ITEMS = [
  { action: 'rename', label: '重命名工作区', icon: 'mdi-rename-box' },
  { sep: true },
  { action: 'remove', label: '移除工作区终端', icon: 'mdi-delete-outline' },
]
const menu = reactive({ open: false, x: 0, y: 0, wsId: '' })
const rename = reactive({ on: false, wsId: '', text: '' })
const remove = reactive({ on: false, wsId: '', name: '', count: 0 })
const rows = computed(() => groupRows(store.groups, props.workspaces, store.groupNames))

function openMenu(row, event) {
  menu.wsId = row.wsId
  menu.x = event.clientX
  menu.y = event.clientY
  menu.open = true
}

function onAction(action) {
  const row = rows.value.find((item) => item.wsId === menu.wsId)
  if (action === 'rename') {
    rename.wsId = menu.wsId
    rename.text = row?.name || ''
    rename.on = true
    return
  }
  if (action === 'remove') {
    remove.wsId = menu.wsId
    remove.name = row?.name || ''
    remove.count = row?.count || 0
    remove.on = true
  }
}

function saveRename() {
  const text = (rename.text || '').trim()
  if (!text || !rename.wsId) return
  store.renameGroup(rename.wsId, text)
  rename.on = false
}

async function confirmRemove() {
  const id = remove.wsId
  remove.on = false
  if (!id) return
  await store.removeGroup(id)
  // 一组不剩就收起面板，别留个空壳。
  if (!Object.values(store.groups).some((found) => found.items.length)) emit('close-dock')
}
</script>

<style scoped>
.groups {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  overflow: hidden;
}
.group-tabs {
  min-width: 0;
  height: 32px;
}
.group-tabs :deep(.v-tab) {
  flex: 0 0 auto;
  min-width: 0;
  height: 32px;
  padding: 0 10px;
  font-size: 12px;
  text-transform: none;
}
.count {
  margin-left: 4px;
  opacity: 0.7;
}
.remove-text {
  font-size: 13px;
  line-height: 1.6;
  opacity: 0.85;
}
</style>
