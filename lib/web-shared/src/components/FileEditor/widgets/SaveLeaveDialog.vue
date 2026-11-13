<template>
  <v-dialog
    :model-value="modelValue"
    max-width="440"
    @update:model-value="(open) => !open && emit('answer', false)"
  >
    <v-card>
      <v-card-title>文件还没保存</v-card-title>
      <v-card-text>
        {{ path || '当前文件' }}
        <p class="tip">换过去之后这次的修改就没了，要保留就先按 Ctrl+S 保存。</p>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="emit('answer', false)">留在这里</v-btn>
        <v-btn color="error" variant="flat" @click="emit('answer', true)">丢掉修改</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
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
