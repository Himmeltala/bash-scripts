<!--
 * @Author: Himmeltala
 * @Date: 2026-11-17 00:15:49
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-17 23:30:14
 * @FilePath: \lib\web-shared\src\layouts\commons\SplitHandle.vue
 * @Description: 可拖动分隔条，双击还原区域尺寸。
-->
<template>
  <div
    class="handle"
    :class="[axis, { active: !disabled && active, disabled }]"
    :title="disabled ? '' : title"
    @pointerdown="down"
    @dblclick="dbl"
  />
</template>

<script setup>
const props = defineProps({
  axis: { type: String, default: 'x' },
  active: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  title: { type: String, default: '拖动调整大小，双击还原' },
})
const emit = defineEmits(['start', 'reset'])

function down(event) {
  if (props.disabled) return
  emit('start', event)
}

function dbl() {
  if (props.disabled) return
  emit('reset')
}
</script>

<style scoped>
.handle {
  position: relative;
  flex: 0 0 7px;
  background: none;
}
.handle::after {
  content: '';
  position: absolute;
  background: rgba(var(--v-theme-on-surface), 0.14);
  transition: background var(--bash-anim-dur-fast, 120ms) ease;
}
.handle.x {
  cursor: col-resize;
}
.handle.x::after {
  top: 0;
  bottom: 0;
  left: 50%;
  width: 1px;
  transform: translateX(-50%);
}
.handle.y {
  flex-basis: 9px;
  cursor: row-resize;
}
.handle.y::after {
  left: 0;
  right: 0;
  top: 50%;
  height: 1px;
  transform: translateY(-50%);
}
.handle:hover:not(.disabled)::after,
.handle.active::after {
  background: rgb(var(--v-theme-primary));
}
.handle.disabled {
  cursor: default;
}
.handle.disabled::after {
  opacity: 0.45;
}
</style>
