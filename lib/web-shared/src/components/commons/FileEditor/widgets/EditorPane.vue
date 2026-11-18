<template>
  <div class="edit-body">
    <div ref="gutterRef" class="gutter" aria-hidden="true">
      <div v-for="n in lineCount" :key="n" class="ln">{{ n }}</div>
    </div>
    <div class="edit-stage">
      <div
        v-show="focused"
        class="cur-line"
        :style="lineStyle"
        aria-hidden="true"
      />
      <pre class="layer-code" aria-hidden="true"><code ref="codeRef" v-html="highlighted"></code></pre>
      <textarea
        ref="editorRef"
        :value="modelValue"
        class="editor"
        wrap="off"
        spellcheck="false"
        @input="onInput"
        @scroll="onScroll"
        @keydown.tab.prevent="insertTab"
        @keyup="syncCaret"
        @mouseup="syncCaret"
        @focus="onFocus"
        @blur="focused = false"
        @click="onClick"
        @contextmenu="onContextMenu"
        @keydown="onKeydown"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue'
import { symbolAt } from '../../../../utils/commons/codeSymbol.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
  highlighted: { type: String, default: '' },
  lineCount: { type: Number, default: 1 },
})

const emit = defineEmits(['update:modelValue', 'symbol', 'menu', 'rename'])

const gutterRef = ref(null)
const codeRef = ref(null)
const editorRef = ref(null)

// 光标所在行单独铺一条底色，跟变更差异里正在编辑的那一行同一套着色。
// 行高与上内边距从编辑框的实际样式量，滚动量与光标行一变就重排。
const focused = ref(false)
const caretLine = ref(0)
const scrollTop = ref(0)
const lineHeight = ref(20)
const padTop = ref(10)
const lineStyle = computed(() => ({
  top: `${padTop.value + caretLine.value * lineHeight.value - scrollTop.value}px`,
  height: `${lineHeight.value}px`,
}))

function measure() {
  const el = editorRef.value
  if (!el) return
  const style = getComputedStyle(el)
  lineHeight.value = parseFloat(style.lineHeight) || 20
  padTop.value = parseFloat(style.paddingTop) || 10
}

// 数光标前的回车个数；有选区时算光标所在的那一头。
function syncCaret() {
  const el = editorRef.value
  if (!el) return
  const pos = el.selectionDirection === 'backward' ? el.selectionStart : el.selectionEnd
  const before = el.value.slice(0, pos)
  let line = 0
  for (let i = 0; i < before.length; i += 1) {
    if (before.charCodeAt(i) === 10) line += 1
  }
  caretLine.value = line
  scrollTop.value = el.scrollTop
}

function onFocus() {
  measure()
  focused.value = true
  syncCaret()
}

function onInput(event) {
  emit('update:modelValue', event.target.value)
  syncCaret()
}

// Ctrl（Mac 上是 Command）+ 左键点在一个词上：把词与 LSP 行列抛给调用方去查定义。
function onClick(event) {
  if (!(event.ctrlKey || event.metaKey) || event.button !== 0) return
  const el = editorRef.value
  if (!el) return
  const symbol = symbolAt(el.value, el.selectionStart)
  if (!symbol) return
  event.preventDefault()
  emit('symbol', symbol)
}

// 右键点在标识符上：不弹浏览器菜单，把词与鼠标位置交给调用方出代码菜单。
function onContextMenu(event) {
  const el = editorRef.value
  if (!el) return
  const symbol = symbolAt(el.value, el.selectionStart)
  if (!symbol) return
  event.preventDefault()
  emit('menu', { ...symbol, x: event.clientX, y: event.clientY })
}

// F2 是 VSCode 的重命名快捷键；浏览器没占它，光标在标识符上就交给调用方。
function onKeydown(event) {
  if (event.key !== 'F2') return
  const el = editorRef.value
  if (!el) return
  const symbol = symbolAt(el.value, el.selectionStart)
  if (!symbol) return
  event.preventDefault()
  emit('rename', symbol)
}

// 高亮层与行号列跟着编辑框一起滚，三层始终对在同一位置。
function syncScroll(el) {
  if (codeRef.value) {
    codeRef.value.style.transform = `translate(${-el.scrollLeft}px, ${-el.scrollTop}px)`
  }
  if (gutterRef.value) gutterRef.value.scrollTop = el.scrollTop
}

function onScroll(event) {
  syncScroll(event.target)
  scrollTop.value = event.target.scrollTop
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
    syncCaret()
  })
}

function resetScroll() {
  const el = editorRef.value
  if (!el) return
  el.scrollTop = 0
  el.scrollLeft = 0
  syncScroll(el)
  // 换文件后视图回到顶部，光标行的高亮从头算起。
  caretLine.value = 0
  scrollTop.value = 0
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
  const size = parseFloat(getComputedStyle(el).lineHeight) || 20
  el.scrollTop = Math.max(0, (index - 1) * size - el.clientHeight / 3)
  syncScroll(el)
  measure()
  focused.value = true
  syncCaret()
}

defineExpose({ resetScroll, locate })
</script>

<style scoped src="./EditorPane.css"></style>
