<!--
 * @Author: Himmeltala
 * @Date: 2026-11-25 00:00:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-26 11:20:00
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
        @close="closeTab"
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
      <p v-if="!items.length" class="none">点 + 新建一个终端。</p>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, watch } from 'vue'
import { useTerminalsStore } from '../../../stores/terminals'
import TerminalTabs from './TerminalTabs.vue'
import TerminalView from './TerminalView.vue'

const props = defineProps({
  wsId: { type: String, default: '' },
})
const emit = defineEmits(['close-dock'])

const store = useTerminalsStore()
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

// 刷新后本地是空的，先把服务端还活着的会话接回来，再决定要不要新建。
onMounted(async () => {
  if (!props.wsId) return
  const id = shownId.value || props.wsId
  store.setView(id)
  await store.restore(id)
})

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
  // 别组关空了就回当前工作区并补一个终端；当前工作区关空了收起 Dock。
  if (id !== props.wsId) {
    store.setView(props.wsId)
    store.ensureSlot(props.wsId)
  } else emit('close-dock')
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
.none {
  margin: 12px;
  font-size: 0.8rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
</style>
