<template>
  <FloatingDialog
    :model-value="modelValue"
    :initial-width="460"
    :initial-height="300"
    :min-width="380"
    :min-height="240"
    storage-key="profile-rename"
    storage="llmx.dialog-layouts"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #title>重命名配置档</template>

    <p class="hint">原名 {{ current }}，只改文件名，不动内容。</p>
    <v-text-field
      v-model="name"
      label="新名称"
      density="compact"
      variant="outlined"
      maxlength="64"
      autofocus
      @keyup.enter="submit"
    />
    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-2">
      {{ error }}
    </v-alert>

    <template #actions>
      <v-spacer />
      <v-btn variant="text" @click="close">取消</v-btn>
      <v-btn
        color="primary"
        variant="flat"
        :loading="busy"
        :disabled="!name || name === current"
        @click="submit"
      >
        改名
      </v-btn>
    </template>
  </FloatingDialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { FloatingDialog } from '@bash-scripts/web-shared'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  current: { type: String, default: '' },
  submit: { type: Function, required: true },
})
const emit = defineEmits(['update:modelValue'])

const name = ref('')
const error = ref('')
const busy = ref(false)

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    name.value = props.current
    error.value = ''
    busy.value = false
  },
)

function close() {
  emit('update:modelValue', false)
}

async function submit() {
  if (!name.value || name.value === props.current) return
  busy.value = true
  error.value = ''
  try {
    await props.submit(name.value)
    close()
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}
</script>
