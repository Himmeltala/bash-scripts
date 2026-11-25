<!--
 * @Author: Himmeltala
 * @Date: 2026-11-25 00:00:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-25 00:00:00
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
import { computed, onMounted } from 'vue'
import { useTerminalsStore } from '../../../stores/terminals'
import TerminalTabs from './TerminalTabs.vue'
import TerminalView from './TerminalView.vue'

const props = defineProps({
  wsId: { type: String, default: '' },
})
const emit = defineEmits(['close-dock'])

const store = useTerminalsStore()
const items = computed(() => (props.wsId ? store.list(props.wsId) : []))
const activeKey = computed(() => (props.wsId ? store.activeSlot(props.wsId)?.key || '' : ''))

onMounted(() => {
  if (props.wsId) store.ensureSlot(props.wsId)
})

function selectTab(key) {
  if (props.wsId) store.setActive(props.wsId, key)
}

function createTab() {
  if (props.wsId) store.createSlot(props.wsId)
}

async function closeTab(key) {
  if (!props.wsId || !key) return
  await store.closeSlot(props.wsId, key)
  if (!items.value.length) emit('close-dock')
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
