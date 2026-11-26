<!--
 * @Author: Himmeltala
 * @Date: 2026-11-25 00:00:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-26 09:35:55
 * @FilePath: \idex\web\src\features\dock\components\DockShell.vue
 * @Description: macOS 式底部 Dock：一排入口图标，点开从下方呼出面板并把 Dock 盖住。
-->
<template>
  <div v-if="!showing" class="dock-zone" @mouseenter="reveal" @mousemove="reveal" />
  <div
    v-if="!showing"
    class="dock"
    :class="{ revealed }"
    @mouseenter="cancelHide"
    @mousemove="cancelHide"
    @mouseleave="scheduleHide"
  >
    <template v-for="item in views" :key="item.id">
      <component
        :is="entryOf(item)"
        v-if="item.entry"
        @open="dock.show(item.id)"
      />
      <DockItem
        v-else
        :icon="item.icon"
        :label="item.title"
        @click="dock.show(item.id)"
      />
    </template>
    <span v-if="views.length" class="sep" />
    <slot name="actions" />
  </div>

  <Transition :name="`sheet-${placement}`" @after-leave="showing = false">
    <div
      v-if="dock.open && currentView"
      class="dock-panel"
      :class="`dock-panel-${placement}`"
      :style="panelStyle"
    >
      <SplitHandle
        v-if="placement === 'bottom'"
        axis="y"
        :active="dragging"
        @start="startDrag"
        @reset="resetDrag"
      />
      <div class="dock-panel-bar">
        <v-icon size="16">{{ activeView?.icon }}</v-icon>
        <span class="dock-panel-title">{{ activeView?.title }}</span>
        <v-spacer />
        <v-btn
          icon="mdi-chevron-down"
          size="x-small"
          variant="text"
          title="收起面板"
          @click="dock.open = false"
        />
      </div>
      <div class="dock-panel-body">
        <component
          :is="currentView"
          :ws-id="wsId"
          @close-dock="dock.open = false"
        />
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { computed, defineAsyncComponent, onBeforeUnmount, ref, watch } from 'vue'
import { SplitHandle } from '@bash-scripts/web-shared/layouts'
import { DEFAULT_DOCK_HEIGHT, useDockStore } from '../../../stores/dock'
import { DOCK_VIEWS } from '../lib/views'
import DockItem from './DockItem.vue'

const props = defineProps({
  wsId: { type: String, default: '' },
  // 可选：当前工作区对象，视图按能力决定自己出现不出现。
  ws: { type: Object, default: null },
})

const dock = useDockStore()
const views = computed(() =>
  DOCK_VIEWS.filter((item) => (typeof item.available === 'function' ? item.available(props.ws) : true)),
)
const components = new Map(
  DOCK_VIEWS.map((item) => [item.id, defineAsyncComponent(item.load)]),
)
const entries = new Map(
  DOCK_VIEWS.filter((item) => item.entry).map((item) => [item.id, defineAsyncComponent(item.entry)]),
)

function entryOf(item) {
  return entries.get(item.id)
}
const activeView = computed(() => views.value.find((item) => item.id === dock.view) || null)
const currentView = computed(() => (activeView.value ? components.get(activeView.value.id) : null))
// 面板在动画期间仍然占位，Dock 等它滑出去再出现。
const showing = ref(dock.open)
// Dock 平时藏在屏幕下方，鼠标碰到最底边才浮出；离开后自动收起。
const revealed = ref(false)
// 鼠标停在 Dock 上不动超过这个时间也收起；有移动就重新计时。
const IDLE_MS = 3000
let hideTimer = 0
const placement = computed(() => activeView.value?.placement || 'bottom')
const panelStyle = computed(() =>
  placement.value === 'left' || placement.value === 'right'
    ? { width: `${Math.min(520, Math.round(window.innerWidth * 0.42))}px` }
    : { height: `${dock.height}px` },
)

watch(
  () => dock.open,
  (on) => {
    if (!on) return
    showing.value = true
    revealed.value = false
  },
)

// 工作区被移除或视图不再可用时，别把 Dock 藏在一个空面板后面。
watch(
  activeView,
  (item) => {
    if (item) return
    dock.open = false
    showing.value = false
  },
  { immediate: true },
)

function scheduleIdle() {
  clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    revealed.value = false
  }, IDLE_MS)
}

function reveal() {
  clearTimeout(hideTimer)
  revealed.value = true
  scheduleIdle()
}

function scheduleHide() {
  clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    revealed.value = false
  }, 350)
}

function cancelHide() {
  scheduleIdle()
}

onBeforeUnmount(() => {
  clearTimeout(hideTimer)
  stopDrag()
})

const dragging = ref(false)
let startY = 0
let startHeight = 0

function startDrag(event) {
  if (event.button !== 0) return
  dragging.value = true
  startY = event.clientY
  startHeight = dock.height
  event.preventDefault()
  document.body.classList.add('web-shared-resizing')
  window.addEventListener('pointermove', onDrag)
  window.addEventListener('pointerup', stopDrag, { once: true })
}

function onDrag(event) {
  const next = startHeight + (startY - event.clientY)
  dock.height = Math.max(160, Math.min(window.innerHeight - 220, next))
}

function stopDrag() {
  if (!dragging.value) return
  dragging.value = false
  document.body.classList.remove('web-shared-resizing')
  window.removeEventListener('pointermove', onDrag)
}

function resetDrag() {
  dock.height = DEFAULT_DOCK_HEIGHT
}
</script>

<style scoped>
.dock-zone {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 19;
  height: 8px;
}
.dock {
  position: fixed;
  left: 50%;
  bottom: 10px;
  z-index: 20;
  transform: translate(-50%, calc(100% + 18px));
  opacity: 0;
  transition: transform 0.18s ease, opacity 0.18s ease;
  display: flex;
  align-items: flex-end;
  gap: 2px;
  padding: 5px 9px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 16px;
  background: rgba(var(--v-theme-surface), 0.86);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.24);
  backdrop-filter: blur(16px);
  pointer-events: none;
}
.dock.revealed {
  transform: translate(-50%, 0);
  opacity: 1;
  pointer-events: auto;
}
.sep {
  width: 1px;
  height: 34px;
  margin: 0 5px 4px;
  background: rgba(var(--v-theme-on-surface), 0.16);
}
.dock-panel {
  position: fixed;
  z-index: 21;
  display: flex;
  flex-direction: column;
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 -12px 30px rgba(0, 0, 0, 0.22);
}
.dock-panel-bottom {
  left: 0;
  right: 0;
  bottom: 0;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.16);
  border-radius: 10px 10px 0 0;
}
.dock-panel-top {
  left: 0;
  right: 0;
  top: 0;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.16);
  border-radius: 0 0 10px 10px;
}
.dock-panel-left {
  left: 0;
  top: 0;
  bottom: 0;
  border-right: 1px solid rgba(var(--v-theme-on-surface), 0.16);
  border-radius: 0 10px 10px 0;
}
.dock-panel-right {
  right: 0;
  top: 0;
  bottom: 0;
  border-left: 1px solid rgba(var(--v-theme-on-surface), 0.16);
  border-radius: 10px 0 0 10px;
}
/* 四个方向各自的滑入滑出。 */
.sheet-bottom-enter-active,
.sheet-bottom-leave-active,
.sheet-top-enter-active,
.sheet-top-leave-active,
.sheet-left-enter-active,
.sheet-left-leave-active,
.sheet-right-enter-active,
.sheet-right-leave-active {
  transition: transform 0.22s ease, opacity 0.22s ease;
}
.sheet-bottom-enter-from,
.sheet-bottom-leave-to {
  transform: translateY(100%);
  opacity: 0.6;
}
.sheet-top-enter-from,
.sheet-top-leave-to {
  transform: translateY(-100%);
  opacity: 0.6;
}
.sheet-left-enter-from,
.sheet-left-leave-to {
  transform: translateX(-100%);
  opacity: 0.6;
}
.sheet-right-enter-from,
.sheet-right-leave-to {
  transform: translateX(100%);
  opacity: 0.6;
}
.dock-panel-bar {
  flex: 0 0 34px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px 0 12px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  user-select: none;
}
.dock-panel-title {
  font-size: 0.78rem;
  font-weight: 600;
}
.dock-panel-body {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  overflow: hidden;
}
</style>
