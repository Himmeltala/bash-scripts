<template>
  <div
    class="handle"
    :class="[axis, { active: !disabled && active, disabled }]"
    :title="disabled ? '' : title"
    @pointerdown="down"
    @dblclick="dbl"
  >
    <span class="grip" />
  </div>
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
  flex: 0 0 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--v-theme-on-surface), 0.04);
}
.handle.x {
  cursor: col-resize;
  border-left: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-right: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
.handle.y {
  flex-basis: 9px;
  cursor: row-resize;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
.handle .grip {
  border-radius: 2px;
  background: rgba(var(--v-theme-on-surface), 0.22);
}
.handle.x .grip {
  width: 3px;
  height: 36px;
}
.handle.y .grip {
  width: 36px;
  height: 3px;
}
.handle:hover:not(.disabled),
.handle.active {
  background: rgba(var(--v-theme-primary), 0.12);
}
.handle:hover:not(.disabled) .grip,
.handle.active .grip {
  background: rgb(var(--v-theme-primary));
}
.handle.disabled {
  cursor: default;
}
.handle.disabled .grip {
  opacity: 0.45;
}
</style>
