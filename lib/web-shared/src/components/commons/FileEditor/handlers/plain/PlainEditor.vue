<template>
  <TextEditor
    ref="editorRef"
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
  />
</template>

<script setup>
import { ref } from 'vue'
import TextEditor from '../TextEditor.vue'

defineProps({
  modelValue: { type: String, default: '' },
  path: { type: String, default: '' },
})

defineEmits(['update:modelValue'])

const editorRef = ref(null)

defineExpose({
  resetScroll: () => editorRef.value?.resetScroll(),
  locate: (line) => editorRef.value?.locate(line),
})
</script>
