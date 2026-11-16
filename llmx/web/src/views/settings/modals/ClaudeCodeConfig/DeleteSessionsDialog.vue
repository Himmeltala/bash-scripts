<template>
  <FloatingDialog
    :model-value="modelValue"
    :initial-width="560"
    :initial-height="420"
    :min-width="440"
    :min-height="300"
    storage-key="sessions-delete"
    storage="llmx.dialog-layouts"
    persistent
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #title>移进回收目录</template>

    <p>
      将移走 <strong>{{ rows.length }}</strong> 个会话、共
      <strong>{{ formatBytes(size) }}</strong>：
    </p>
    <v-chip-group column>
      <v-chip v-for="name in projects" :key="name" size="small" variant="tonal">{{ name }}</v-chip>
    </v-chip-group>
    <p class="hint">
      文件会移到 <code>{{ garbage }}</code>，账本里的用量记录不动，历史统计不会变小。
      回收目录要腾空间时自己清。
    </p>
    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-2">
      {{ error }}
    </v-alert>

    <template #actions>
      <v-spacer />
      <v-btn variant="text" @click="close">取消</v-btn>
      <v-btn color="error" variant="flat" :loading="busy" @click="submit">移进回收目录</v-btn>
    </template>
  </FloatingDialog>
</template>

<script setup>
import { computed, ref } from 'vue'
import { FloatingDialog } from '@bash-scripts/web-shared'
import { formatBytes } from '@bash-scripts/web-shared/format'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  rows: { type: Array, default: () => [] },
  garbage: { type: String, default: '' },
  submit: { type: Function, required: true },
})
const emit = defineEmits(['update:modelValue'])

const error = ref('')
const busy = ref(false)

const size = computed(() => props.rows.reduce((sum, row) => sum + (row.size || 0), 0))
const projects = computed(() => [...new Set(props.rows.map((row) => row.project).filter(Boolean))])

function close() {
  error.value = ''
  emit('update:modelValue', false)
}

async function submit() {
  busy.value = true
  error.value = ''
  try {
    await props.submit(props.rows.map((row) => row.id))
    close()
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}
</script>
