<template>
  <v-dialog
    :model-value="modelValue"
    :width="size.w"
    :height="size.h"
    :content-props="{ style: positionStyle }"
    scrollable
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card class="dialog" :class="{ moving }">
      <v-card-title
        class="title d-flex align-center"
        title="拖动标题移动窗口，双击回到屏幕中间"
        @pointerdown="startMove"
        @dblclick="recenter"
      >
        <slot name="title" />
      </v-card-title>
      <v-card-text class="body">
        <slot />
      </v-card-text>
      <v-card-actions v-if="$slots.actions">
        <slot name="actions" />
      </v-card-actions>
      <span class="resize-grip" title="拖动调整窗口大小" @pointerdown="startResize" />
    </v-card>
  </v-dialog>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useDialogLayoutStore } from '../stores/dialogLayout'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  initialWidth: { type: Number, default: 760 },
  initialHeight: { type: Number, default: 620 },
  minWidth: { type: Number, default: 480 },
  minHeight: { type: Number, default: 380 },
  // 同一个 key 的弹窗共用一份位置与大小；留空就只在这次会话里用。
  storageKey: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

// 窗口不被布局居中，而是用固定定位摆在 pos 上；拖动标题改 pos，拖右下角改尺寸。
const layoutStore = useDialogLayoutStore()
const saved = layoutStore.get(props.storageKey)
const size = ref(saved ? { w: saved.w, h: saved.h } : fitSize())
const pos = ref(saved ? { x: saved.x, y: saved.y } : { x: 0, y: 0 })
// 用户拖过之后，下次打开停在原处；没拖过就每次居中。
const placed = ref(!!saved)
const moving = ref(false)
let drag = null

const positionStyle = computed(() => ({
  position: 'fixed',
  left: `${pos.value.x}px`,
  top: `${pos.value.y}px`,
  margin: '0',
}))

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function fitSize() {
  return {
    w: Math.min(props.initialWidth, Math.max(props.minWidth, window.innerWidth - 48)),
    h: Math.min(props.initialHeight, Math.max(props.minHeight, window.innerHeight - 48)),
  }
}

function center() {
  pos.value = {
    x: Math.max(0, Math.round((window.innerWidth - size.value.w) / 2)),
    y: Math.max(0, Math.round((window.innerHeight - size.value.h) / 2)),
  }
}

function keepInside() {
  pos.value = {
    x: clamp(pos.value.x, 0, Math.max(0, window.innerWidth - size.value.w)),
    y: clamp(pos.value.y, 0, Math.max(0, window.innerHeight - size.value.h)),
  }
}

// 打开时把尺寸收回窗口里；拖过的位置也收回，没拖过就重新居中。
watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    size.value = {
      w: clamp(size.value.w, props.minWidth, Math.max(props.minWidth, window.innerWidth - 48)),
      h: clamp(size.value.h, props.minHeight, Math.max(props.minHeight, window.innerHeight - 48)),
    }
    if (placed.value) keepInside()
    else center()
  },
  { immediate: true },
)

// 标题上的按钮、输入框不参与拖动，点关闭照常关。
function startMove(event) {
  if (event.button !== 0) return
  if (event.target.closest('button, a, input, textarea, select, [role="button"]')) return
  event.preventDefault()
  begin('move', event)
}

function startResize(event) {
  if (event.button !== 0) return
  event.preventDefault()
  begin('resize', event)
}

function begin(mode, event) {
  drag = {
    mode,
    x: event.clientX,
    y: event.clientY,
    px: pos.value.x,
    py: pos.value.y,
    w: size.value.w,
    h: size.value.h,
  }
  moving.value = true
  document.body.style.userSelect = 'none'
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', end, { once: true })
}

function onMove(event) {
  if (!drag) return
  const dx = event.clientX - drag.x
  const dy = event.clientY - drag.y
  placed.value = true
  if (drag.mode === 'move') {
    pos.value = {
      x: clamp(drag.px + dx, 0, Math.max(0, window.innerWidth - size.value.w)),
      y: clamp(drag.py + dy, 0, Math.max(0, window.innerHeight - size.value.h)),
    }
    return
  }
  // 右下角拉，左上角钉住：不超过窗口留白后的宽度，也不越过窗口边缘。
  const maxW = Math.max(props.minWidth, Math.min(window.innerWidth - 48, window.innerWidth - pos.value.x))
  const maxH = Math.max(props.minHeight, Math.min(window.innerHeight - 48, window.innerHeight - pos.value.y))
  size.value = {
    w: clamp(drag.w + dx, props.minWidth, maxW),
    h: clamp(drag.h + dy, props.minHeight, maxH),
  }
}

function end() {
  const moved = drag !== null
  drag = null
  moving.value = false
  document.body.style.userSelect = ''
  window.removeEventListener('pointermove', onMove)
  if (moved) save()
}

// 大小与位置只在拖完时落一次，拖动过程中不写存储。
function save() {
  layoutStore.remember(props.storageKey, {
    x: pos.value.x,
    y: pos.value.y,
    w: size.value.w,
    h: size.value.h,
  })
}

function recenter() {
  placed.value = false
  center()
  save()
}

onBeforeUnmount(end)
</script>

<style scoped>
.dialog {
  position: relative;
}
.title {
  cursor: move;
  user-select: none;
  touch-action: none;
}
.dialog.moving .title {
  cursor: grabbing;
}
.body {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}
.resize-grip {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 18px;
  height: 18px;
  z-index: 3;
  cursor: nwse-resize;
  touch-action: none;
  background: linear-gradient(135deg, transparent 50%, rgba(var(--v-theme-on-surface), 0.3) 50%);
}
.resize-grip:hover {
  background: linear-gradient(135deg, transparent 50%, rgb(var(--v-theme-primary)) 50%);
}
</style>
