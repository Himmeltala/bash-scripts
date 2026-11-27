<!--
 * @Author: Himmeltala
 * @Date: 2026-11-25 00:00:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-26 18:40:00
 * @FilePath: \idex\web\src\features\terminal\components\TerminalPanel.vue
 * @Description: 终端视图内容：多个终端标签与各自的 xterm；外壳由 DockShell 提供。
-->
<template>
  <div class="terminal-panel">
    <div class="term-bar">
      <TerminalTabs
        :items="items"
        :active-key="activeKey"
        @select="selectTab"
        @create="createTab"
        @menu="openTabMenu"
      />
    </div>
    <div class="term-body">
      <TerminalView
        v-for="item in items"
        v-show="item.key === activeKey"
        :key="item.key"
        :session="item"
        :active="item.key === activeKey"
      />
      <EmptyState
        v-if="!items.length"
        icon="mdi-console"
        :icon-size="44"
        title="还没有终端"
        hint="点上面的 + 新建一个。"
      />
    </div>
  </div>
  <ContextMenu
    v-model="tabMenu.open"
    :x="tabMenu.x"
    :y="tabMenu.y"
    :items="TAB_ACTIONS"
    @select="onTabAction"
  />

  <FloatingDialog
    v-model="rename.on"
    :initial-width="440"
    :initial-height="240"
    :min-width="340"
    :min-height="200"
    :z-index="3300"
  >
    <template #title>重命名终端</template>
    <v-text-field
      v-model="rename.text"
      label="名称"
      density="compact"
      variant="outlined"
      maxlength="40"
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
import { computed, onMounted, reactive, watch } from 'vue'
import { EmptyState } from '@bash-scripts/web-shared/layouts'
import { ContextMenu, FloatingDialog } from '@bash-scripts/web-shared/feedbacks'
import { useTerminalsStore } from '../../../stores/terminals'
import TerminalTabs from './TerminalTabs.vue'
import TerminalView from './TerminalView.vue'

const props = defineProps({
  wsId: { type: String, default: '' },
})
const emit = defineEmits(['close-dock'])

const store = useTerminalsStore()
// 标签右键：重命名与关闭；重命名只改本地显示，不碰服务端的 shell 名。
const TAB_ACTIONS = [
  { action: 'rename', label: '重命名', icon: 'mdi-rename-box' },
  { sep: true },
  { action: 'close', label: '关闭终端', icon: 'mdi-close' },
]
const tabMenu = reactive({ open: false, x: 0, y: 0, key: '' })
const rename = reactive({ on: false, key: '', text: '' })
// 显示哪一组：查看组还有终端就看它，否则回到当前工作区。
// 这里只读不写，写回交给 watcher，避免在计算属性里改状态。
const shownId = computed(() => {
  const view = store.viewWsId
  const alive = view && (store.groups[view]?.items?.length || 0) > 0
  return alive ? view : props.wsId
})
const items = computed(() => (shownId.value ? store.list(shownId.value) : []))
const activeKey = computed(() => (shownId.value ? store.activeSlot(shownId.value)?.key || '' : ''))

watch(shownId, async (id) => {
  if (!id) return
  if (store.viewWsId !== id) store.setView(id)
  // 切到一组本地还没有的（比如刷新后换工作区），同样先接服务端会话。
  if (!store.list(id).length) await store.restore(id)
})

// 刷新后本地是空的，先把服务端还活着的会话接回来；
// 只有从来没开过终端（哪个工作区都没有）才自动建一个，其余等用户点 +。
onMounted(async () => {
  if (!props.wsId) return
  // 先看上次停在哪一组；那组没会话了再退回当前工作区。
  let id = store.viewWsId || props.wsId
  store.setView(id)
  let items = await store.restore(id)
  if (!items.length && id !== props.wsId) {
    id = props.wsId
    store.setView(id)
    items = await store.restore(id)
  }
  // 头一回打开、且哪都没有终端才自动建；之后一律等用户点 +。
  if (!items.length && id === props.wsId) store.bootstrap(id)
})

function openTabMenu({ item, event }) {
  tabMenu.key = item.key
  tabMenu.x = event.clientX
  tabMenu.y = event.clientY
  tabMenu.open = true
}

function onTabAction(action) {
  if (action === 'close') {
    closeTab(tabMenu.key)
    return
  }
  const slot = items.value.find((item) => item.key === tabMenu.key)
  if (!slot) return
  rename.key = slot.key
  rename.text = slot.title || ''
  rename.on = true
}

function saveRename() {
  const text = (rename.text || '').trim()
  if (!text) return
  store.renameSlot(rename.key, text)
  rename.on = false
}

function selectTab(key) {
  if (shownId.value) store.setActive(shownId.value, key)
}

function createTab() {
  if (shownId.value) store.createSlot(shownId.value)
}

async function closeTab(key) {
  const id = shownId.value
  if (!id || !key) return
  await store.closeSlot(id, key)
  if (items.value.length) return
  // 别组关空了就回当前工作区，留空等用户点 +；当前工作区关空了收起 Dock。
  if (id !== props.wsId) store.setView(props.wsId)
  else emit('close-dock')
}
</script>

<style scoped>
.terminal-panel {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.term-bar {
  flex: 0 0 30px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 6px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
.term-body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  overflow: hidden;
}
</style>
