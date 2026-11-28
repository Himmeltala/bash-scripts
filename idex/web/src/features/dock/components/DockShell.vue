<!--
 * @Author: Himmeltala
 * @Date: 2026-11-25 00:00:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-26 17:05:00
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
        class="edge"
        :axis="horizontal ? 'x' : 'y'"
        :active="dragging"
        @start="startDrag"
        @reset="resetDrag"
      />
      <div class="dock-panel-inner">
        <div class="dock-panel-bar">
          <v-icon size="16">{{ activeView?.icon }}</v-icon>
          <span class="dock-panel-title">{{ activeView?.title }}</span>
          <slot name="panel-bar" :view="activeView" />
          <v-spacer />
          <v-btn
            v-for="side in SIDES"
            :key="side.value"
            :icon="side.icon"
            :title="side.title"
            :color="placement === side.value ? 'primary' : undefined"
            size="x-small"
            variant="text"
            @click="dock.setPlacement(activeView?.id, side.value)"
          />
          <v-btn
            :icon="collapseIcon"
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
    </div>
  </Transition>
</template>

<script setup>
import { computed, defineAsyncComponent, onBeforeUnmount, ref, watch } from 'vue'
import { SplitHandle } from '@bash-scripts/web-shared/layouts'
import { DEFAULT_DOCK_HEIGHT, DEFAULT_DOCK_WIDTH, useDockStore } from '../../../stores/dock'
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
// 呼出方向按视图分开记：改终端的方向不影响日志。
const SIDES = [
  { value: 'left', icon: 'mdi-dock-left', title: '从左侧呼出' },
  { value: 'bottom', icon: 'mdi-dock-bottom', title: '从下方呼出' },
  { value: 'top', icon: 'mdi-dock-top', title: '从上方呼出' },
  { value: 'right', icon: 'mdi-dock-right', title: '从右侧呼出' },
]
const placement = computed(() =>
  dock.placementOf(activeView.value?.id, activeView.value?.placement || 'bottom'),
)
// 左右呼出时拖宽度，上下呼出时拖高度。
const horizontal = computed(() => placement.value === 'left' || placement.value === 'right')
// 收起按钮朝面板贴边的那一侧收，方向跟着呼出方向变。
const collapseIcon = computed(
  () =>
    ({
      bottom: 'mdi-chevron-down',
      top: 'mdi-chevron-up',
      left: 'mdi-chevron-left',
      right: 'mdi-chevron-right',
    })[placement.value] || 'mdi-chevron-down',
)
const panelStyle = computed(() =>
  horizontal.value
    ? { width: `${Math.min(dock.width, Math.round(window.innerWidth * 0.9))}px` }
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
let startX = 0
let startY = 0
let startSize = 0

function startDrag(event) {
  if (event.button !== 0) return
  dragging.value = true
  startX = event.clientX
  startY = event.clientY
  startSize = horizontal.value ? dock.width : dock.height
  event.preventDefault()
  document.body.classList.add('web-shared-resizing')
  window.addEventListener('pointermove', onDrag)
  window.addEventListener('pointerup', stopDrag, { once: true })
}

function onDrag(event) {
  // 往面板里侧拖是变大，方向按呼出边换。
  const delta = horizontal.value
    ? placement.value === 'left'
      ? event.clientX - startX
      : startX - event.clientX
    : placement.value === 'top'
      ? event.clientY - startY
      : startY - event.clientY
  const next = startSize + delta
  if (horizontal.value) {
    dock.width = Math.max(260, Math.min(window.innerWidth - 360, next))
  } else {
    dock.height = Math.max(160, Math.min(window.innerHeight - 220, next))
  }
}

function stopDrag() {
  if (!dragging.value) return
  dragging.value = false
  document.body.classList.remove('web-shared-resizing')
  window.removeEventListener('pointermove', onDrag)
}

function resetDrag() {
  if (horizontal.value) dock.width = DEFAULT_DOCK_WIDTH
  else dock.height = DEFAULT_DOCK_HEIGHT
}
</script>

<style scoped>
/* 高过 Vuetify 叠加层（约 2400–2500）。 */
.dock-zone {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 3080;
  height: 8px;
}
.dock {
  position: fixed;
  left: 50%;
  bottom: 10px;
  z-index: 3100;
  transform: translate(-50%, calc(100% + 18px));
  opacity: 0;
  transition: transform var(--bash-anim-dur-fast) var(--bash-anim-ease), opacity var(--bash-anim-dur-fast) var(--bash-anim-ease);
  display: flex;
  align-items: flex-end;
  gap: 2px;
  padding: 5px 9px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
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
  z-index: 3090;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 -12px 30px rgba(0, 0, 0, 0.22);
}
.dock-panel-left,
.dock-panel-right {
  flex-direction: row;
}
.dock-panel-top .edge,
.dock-panel-left .edge {
  order: 10;
}
.dock-panel-inner {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.dock-panel-bottom {
  left: 0;
  right: 0;
  bottom: 0;
}
.dock-panel-top {
  left: 0;
  right: 0;
  top: 0;
}
.dock-panel-left {
  left: 0;
  top: 0;
  bottom: 0;
}
.dock-panel-right {
  right: 0;
  top: 0;
  bottom: 0;
}
.sheet-bottom-enter-active,
.sheet-bottom-leave-active,
.sheet-top-enter-active,
.sheet-top-leave-active,
.sheet-left-enter-active,
.sheet-left-leave-active,
.sheet-right-enter-active,
.sheet-right-leave-active {
  transition: transform var(--bash-anim-dur) var(--bash-anim-ease), opacity var(--bash-anim-dur) var(--bash-anim-ease);
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
