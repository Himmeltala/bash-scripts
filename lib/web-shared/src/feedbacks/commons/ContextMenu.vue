<!--
 * @Author: Himmeltala
 * @Date: 2026-11-26 15:40:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-26 15:40:00
 * @FilePath: \lib\web-shared\src\feedbacks\commons\ContextMenu.vue
 * @Description: 通用右键菜单：按鼠标位置弹出，自动躲开窗口边缘，点外面或按 Esc 收起。
-->
<template>
  <Teleport to="body">
    <AnimatePresence>
      <motion.div
        v-if="modelValue"
        ref="panel"
        class="ctx-menu"
        :style="style"
        :initial="{ opacity: 0, scale: 0.9, y: -6 }"
        :animate="{ opacity: 1, scale: 1, y: 0 }"
        :exit="{ opacity: 0, scale: 0.97, transition: { duration: timing.exit } }"
        :transition="{ duration: timing.duration, ease: timing.ease }"
        role="menu"
      >
        <template v-for="(item, index) in items" :key="index">
          <div v-if="item.sep" class="ctx-sep" />
          <button
            v-else
            type="button"
            class="ctx-item"
            :class="{ danger: item.danger }"
            :style="item.indent ? { paddingLeft: `${10 + item.indent * 18}px` } : null"
            role="menuitem"
            :disabled="item.disabled"
            @click="pick(item)"
          >
            <v-icon v-if="item.icon" size="16">{{ item.icon }}</v-icon>
            <span>{{ item.label }}</span>
          </button>
        </template>
      </motion.div>
    </AnimatePresence>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { AnimatePresence, motion } from 'motion-v'
import { clampMenuPosition } from '../../utils/commons/menu'
import { parseEase, parseTime } from '../../utils/commons/animation'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  // 鼠标位置，也就是菜单左上角的理想坐标。
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  // 每项：{ action, label, icon, disabled }，分隔线写成 { sep: true }。
  items: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue', 'select'])

const panel = ref(null)
const pos = reactive({ x: 0, y: 0 })
// 时长与缓动读全局动画变量，设置里换了方案，菜单也跟着变。
const timing = reactive({ duration: 0.18, exit: 0.11, ease: [0.16, 1, 0.3, 1] })

function readTiming() {
  if (typeof document === 'undefined') return
  const style = getComputedStyle(document.documentElement)
  timing.duration = parseTime(style.getPropertyValue('--bash-anim-dur'))
  timing.exit = timing.duration * 0.6
  timing.ease = parseEase(style.getPropertyValue('--bash-anim-ease'))
}
// 菜单从鼠标那个角长出来；被窗口挤到另一边时换成对角的角。
const style = computed(() => ({
  left: `${pos.x}px`,
  top: `${pos.y}px`,
  transformOrigin: `${props.x <= pos.x ? 'left' : 'right'} ${props.y <= pos.y ? 'top' : 'bottom'}`,
}))

function menuHeight() {
  return (props.items || []).reduce((sum, item) => sum + (item.sep ? 9 : 31), 8)
}

function close() {
  emit('update:modelValue', false)
}

function pick(item) {
  if (item.disabled) return
  emit('select', item.action)
  // 复制路径、进子菜单这类，动作后菜单还要留着。
  if (!item.keepOpen) close()
}

function place() {
  const el = panel.value?.$el || panel.value
  if (!el || !el.getBoundingClientRect) return
  const rect = el.getBoundingClientRect()
  const next = clampMenuPosition({
    x: props.x,
    y: props.y,
    width: rect.width,
    height: rect.height,
    viewport: { width: window.innerWidth, height: window.innerHeight },
  })
  pos.x = next.x
  pos.y = next.y
}

function onOutside(event) {
  const el = panel.value?.$el || panel.value
  if (el && el.contains && !el.contains(event.target)) close()
}

function onKey(event) {
  if (event.key === 'Escape') close()
}

// 窗口一动菜单就跟不上鼠标位置了，直接收起来最省事。

function onViewport() {
  close()
}

function bind() {
  window.addEventListener('mousedown', onOutside, true)
  window.addEventListener('keydown', onKey, true)
  window.addEventListener('resize', onViewport)
  window.addEventListener('scroll', onViewport, true)
}

function unbind() {
  window.removeEventListener('mousedown', onOutside, true)
  window.removeEventListener('keydown', onKey, true)
  window.removeEventListener('resize', onViewport)
  window.removeEventListener('scroll', onViewport, true)
}

function aim() {
  // 先按条目数估个高度摆好，量到真实尺寸后再校正一次，免得弹出来跳一下。
  const guess = clampMenuPosition({
    x: props.x,
    y: props.y,
    width: 196,
    height: menuHeight(),
    viewport: { width: window.innerWidth, height: window.innerHeight },
  })
  pos.x = guess.x
  pos.y = guess.y
  nextTick(place)
}

watch(
  () => props.modelValue,
  (on) => {
    if (!on) {
      unbind()
      return
    }
    readTiming()
    aim()
    bind()
  },
  { immediate: true },
)

// 菜单开着时再右键别处，位置跟着换过去。
watch(
  () => [props.x, props.y],
  () => {
    if (props.modelValue) aim()
  },
)

onBeforeUnmount(unbind)
</script>

<style scoped>
.ctx-menu {
  position: fixed;
  z-index: 3000;
  min-width: 196px;
  max-width: 320px;
  padding: 4px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 8px;
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.24);
}
.ctx-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 10px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: inherit;
  font-size: 0.8rem;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
}
.ctx-item:hover:not(:disabled) {
  background: rgba(var(--v-theme-primary), 0.12);
}
.ctx-item.danger {
  color: rgb(var(--v-theme-error));
}
.ctx-item:disabled {
  opacity: 0.5;
  cursor: default;
}
.ctx-sep {
  height: 1px;
  margin: 4px 6px;
  background: rgba(var(--v-theme-on-surface), 0.1);
}
</style>
