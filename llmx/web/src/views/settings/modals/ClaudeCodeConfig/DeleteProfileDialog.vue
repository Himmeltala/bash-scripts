<template>
  <FloatingDialog
    :model-value="modelValue"
    :initial-width="460"
    :initial-height="280"
    :min-width="380"
    :min-height="220"
    storage-key="profile-delete"
    storage="llmx.dialog-layouts"
    persistent
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #title>删除配置档</template>

    <p>确定删除配置档 <strong>{{ name }}</strong>？</p>
    <p class="hint">
      只删这份配置档文件，<code>settings.json</code> 不动；正在生效的配置删掉后只是不再标记。
    </p>
    <template #actions>
      <v-spacer />
      <v-btn variant="text" @click="close">取消</v-btn>
      <v-btn color="error" variant="flat" :loading="busy" @click="submit">删除</v-btn>
    </template>
  </FloatingDialog>
</template>

<script setup>
import { watch, ref } from 'vue'
import { toast } from '../../../../composables/notice'
import { FloatingDialog } from '@bash-scripts/web-shared/feedbacks'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  name: { type: String, default: '' },
  submit: { type: Function, required: true },
})
const emit = defineEmits(['update:modelValue'])

const error = ref('')
watch(error, (text) => text && toast(text, 'error'))
const busy = ref(false)

function close() {
  error.value = ''
  emit('update:modelValue', false)
}

async function submit() {
  busy.value = true
  error.value = ''
  try {
    await props.submit()
    close()
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}
</script>
