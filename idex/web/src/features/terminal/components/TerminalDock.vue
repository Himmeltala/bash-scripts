<!--
 * @Author: Himmeltala
 * @Date: 2026-11-25 00:00:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-25 00:00:00
 * @FilePath: \idex\web\src\features\terminal\components\TerminalDock.vue
 * @Description: 全宽底部终端面板；跨页面、跨工作区常驻，收起后只留一条底栏。
-->
<template>
  <div class="dock" :class="{ open }" :style="dockStyle">
    <div class="bar" @dblclick="open = !open">
      <v-icon size="15">mdi-console</v-icon>
      <TerminalTabs
        v-if="open"
        :items="items"
        :active-key="activeKey"
        @select="selectTab"
        @create="createTab"
        @close="closeTab"
      />
      <span v-else class="collapsed">
        终端<span v-if="items.length" class="count">{{ items.length }}</span>
      </span>
      <v-spacer />
      <v-btn
        v-if="open"
        icon="mdi-close-box-outline"
        size="x-small"
        variant="text"
        title="关闭当前终端"
        :disabled="!activeKey"
        @click="closeTab(activeKey)"
      />
      <v-btn
        :icon="open ? 'mdi-chevron-down' : 'mdi-chevron-up'"
        size="x-small"
        variant="text"
        :title="open ? '收起终端' : '展开终端'"
        @click="open = !open"
      />
    </div>
    <div v-if="open" class="body">
      <div class="drag" title="拖动调整终端高度" @mousedown.prevent="startDrag" />
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
import { computed } from 'vue'
import { useTerminalsStore } from '../../../stores/terminals'
import { usePreferencesStore } from '../../../stores/preferences'
import TerminalTabs from './TerminalTabs.vue'
import TerminalView from './TerminalView.vue'

const props = defineProps({
  wsId: { type: String, default: '' },
})

const store = useTerminalsStore()
const preferences = usePreferencesStore()
const open = computed({
  get: () => preferences.terminalOpen,
  set: (value) => {
    preferences.terminalOpen = value
    // 只在这一个工作区还没有终端时补一个；切工作区看到的是它自己的那组。
    if (value && props.wsId) store.ensureSlot(props.wsId)
  },
})
const height = computed({
  get: () => preferences.terminalHeight,
  set: (value) => {
    preferences.terminalHeight = value
  },
})

const dockStyle = computed(() => ({ height: `${open.value ? height.value : 32}px` }))

const items = computed(() => (props.wsId ? store.list(props.wsId) : []))
const activeKey = computed(() => {
  if (!props.wsId) return ''
  return store.activeSlot(props.wsId)?.key || ''
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
  if (!items.value.length) open.value = false
}

// 拖动上边缘调高度；只改本地偏好，不碰会话。
let dragStart = 0
let dragHeight = 0
function startDrag(event) {
  dragStart = event.clientY
  dragHeight = height.value
  window.addEventListener('mousemove', onDrag)
  window.addEventListener('mouseup', stopDrag)
}
function onDrag(event) {
  const next = dragHeight + (dragStart - event.clientY)
  height.value = Math.max(140, Math.min(window.innerHeight - 220, next))
}
function stopDrag() {
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('mouseup', stopDrag)
}
</script>

<style scoped>
.dock {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 15;
  display: flex;
  flex-direction: column;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.16);
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 -4px 14px rgba(0, 0, 0, 0.12);
}
.bar {
  flex: 0 0 32px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  user-select: none;
}
.collapsed {
  font-size: 0.76rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.count {
  margin-left: 4px;
  padding: 0 5px;
  border-radius: 8px;
  background: rgba(var(--v-theme-on-surface), 0.1);
}
.body {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  overflow: hidden;
}
.drag {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  z-index: 3;
  cursor: row-resize;
}
.none {
  margin: 12px;
  font-size: 0.8rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
</style>
