<!--
 * @Author: Himmeltala
 * @Date: 2026-11-28 22:20:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-28 22:20:00
 * @FilePath: \lib\web-shared\src\components\commons\FileEditor\handlers\markdown\MarkdownSplit.vue
 * @Description: Markdown 双栏：左边源码、右边渲染，中间用共享分隔条调宽度。
-->
<template>
  <div ref="area" class="md-split">
    <div class="md-pane source" :style="{ width: `${size}%` }">
      <MarkdownEditor
        ref="editorRef"
        :model-value="modelValue"
        :path="path"
        @update:model-value="$emit('update:modelValue', $event)"
      />
    </div>
    <SplitHandle axis="x" :active="resizing" @start="start" @reset="reset" />
    <div class="md-pane render">
      <MarkdownView :model-value="modelValue" :path="path" />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { SplitHandle } from '../../../../../layouts'
import { useSplitPane } from '../../../../../composables/commons/useSplitPane.js'
import MarkdownEditor from './MarkdownEditor.vue'
import MarkdownView from './MarkdownView.vue'

defineProps({
  modelValue: { type: String, default: '' },
  path: { type: String, default: '' },
})

defineEmits(['update:modelValue'])

const area = ref(null)
const editorRef = ref(null)
const { size, resizing, start, reset } = useSplitPane({
  area,
  initial: 50,
  min: 20,
  max: 80,
  unit: 'pct',
  persist: 'web-shared.markdown-split',
})

defineExpose({
  resetScroll: () => editorRef.value?.resetScroll(),
  locate: (line) => editorRef.value?.locate(line),
})
</script>

<style scoped>
.md-split {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  min-width: 0;
}
.md-pane {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.md-pane.source {
  flex: 0 0 auto;
  border-right: 0;
}
.md-pane.render {
  flex: 1 1 auto;
}
</style>
