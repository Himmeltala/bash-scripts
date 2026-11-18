<template>
  <EditorPane
    ref="paneRef"
    :model-value="modelValue"
    :highlighted="highlighted"
    :line-count="lineCount"
    :markers="markers"
    @update:model-value="$emit('update:modelValue', $event)"
    @symbol="$emit('symbol', $event)"
    @menu="$emit('menu', $event)"
    @rename="$emit('rename', $event)"
    @caret="$emit('caret', $event)"
    @edit="$emit('edit')"
  />
</template>

<script setup>
import { computed, ref } from 'vue'
import EditorPane from '../widgets/EditorPane.vue'
import { highlightCode } from '../../../../utils/commons/highlight.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
  // 由各类型的处理器给：代码取扩展名对应的语言，markdown 固定，纯文本为空。
  language: { type: String, default: '' },
  markers: { type: Object, default: () => ({}) },
})

defineEmits(['update:modelValue', 'symbol', 'menu', 'rename', 'caret', 'edit'])

const paneRef = ref(null)

// 末尾的换行只对应编辑框里多出来的空行，着色与行号按实际内容走。
const text = computed(() =>
  props.modelValue.endsWith('\n') ? props.modelValue.slice(0, -1) : props.modelValue,
)
const highlighted = computed(() => highlightCode(text.value, props.language))
const lineCount = computed(() => props.modelValue.split('\n').length)

defineExpose({
  resetScroll: () => paneRef.value?.resetScroll(),
  locate: (line) => paneRef.value?.locate(line),
})
</script>
