<template>
  <div class="edit-body">
    <div ref="gutterRef" class="gutter" aria-hidden="true">
      <div v-for="n in lineCount" :key="n" class="ln">{{ n }}</div>
    </div>
    <div class="edit-stage">
      <pre class="layer-code" aria-hidden="true"><code ref="codeRef" v-html="highlighted"></code></pre>
      <textarea
        ref="editorRef"
        :value="modelValue"
        class="editor"
        wrap="off"
        spellcheck="false"
        @input="$emit('update:modelValue', $event.target.value)"
        @scroll="onScroll"
        @keydown.tab.prevent="insertTab"
      />
    </div>
  </div>
</template>

<script setup>
import { nextTick, ref } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  highlighted: { type: String, default: '' },
  lineCount: { type: Number, default: 1 },
})

const emit = defineEmits(['update:modelValue'])

const gutterRef = ref(null)
const codeRef = ref(null)
const editorRef = ref(null)

// 高亮层与行号列跟着编辑框一起滚，三层始终对在同一位置。
function syncScroll(el) {
  if (codeRef.value) {
    codeRef.value.style.transform = `translate(${-el.scrollLeft}px, ${-el.scrollTop}px)`
  }
  if (gutterRef.value) gutterRef.value.scrollTop = el.scrollTop
}

function onScroll(event) {
  syncScroll(event.target)
}

// 编辑框里 Tab 插入四个空格，而不是把焦点移走。
function insertTab(event) {
  const el = event.target
  const start = el.selectionStart
  const end = el.selectionEnd
  emit('update:modelValue', `${props.modelValue.slice(0, start)}    ${props.modelValue.slice(end)}`)
  nextTick(() => {
    el.selectionStart = start + 4
    el.selectionEnd = start + 4
  })
}

function resetScroll() {
  const el = editorRef.value
  if (!el) return
  el.scrollTop = 0
  el.scrollLeft = 0
  syncScroll(el)
}

// 内容命中的行选中，并滚到可视区上三分之一处。
async function locate(line) {
  await nextTick()
  const el = editorRef.value
  if (!el) return
  const lines = props.modelValue.split('\n')
  const index = Math.min(Math.max(Number(line) || 1, 1), lines.length)
  let start = 0
  for (let i = 0; i < index - 1; i += 1) start += lines[i].length + 1
  el.focus()
  el.setSelectionRange(start, start + lines[index - 1].length)
  const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20
  el.scrollTop = Math.max(0, (index - 1) * lineHeight - el.clientHeight / 3)
  syncScroll(el)
}

defineExpose({ resetScroll, locate })
</script>

<style scoped src="./EditorPane.css"></style>
