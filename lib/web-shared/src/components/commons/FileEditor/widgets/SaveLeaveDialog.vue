<template>
  <FloatingDialog
    :model-value="modelValue"
    :initial-width="440"
    :initial-height="280"
    :min-width="340"
    :min-height="200"
    @update:model-value="(open) => !open && emit('answer', false)"
  >
    <template #title>文件还没保存</template>
    {{ path || '当前文件' }}
    <p class="tip">换过去之后这次的修改就没了，要保留就先按 Ctrl+S 保存。</p>
    <template #actions>
      <v-spacer />
      <v-btn variant="text" @click="emit('answer', false)">留在这里</v-btn>
      <v-btn color="error" variant="flat" @click="emit('answer', true)">丢掉修改</v-btn>
    </template>
  </FloatingDialog>
</template>

<script setup>
import FloatingDialog from '../../FloatingDialog.vue'

defineProps({
  modelValue: { type: Boolean, default: false },
  path: { type: String, default: '' },
})

const emit = defineEmits(['answer'])
</script>

<style scoped>
.tip {
  margin-top: 8px;
  font-size: 0.78rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
</style>
