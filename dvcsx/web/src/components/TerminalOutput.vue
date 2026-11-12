<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

const props = defineProps({
  text: { type: String, default: '' },
  dark: { type: Boolean, default: false },
})

// 与 nodex 的日志区用同一组底色。
const THEMES = {
  normal: { background: '#11151c', foreground: '#d6deeb', selectionBackground: '#2f4366' },
  deeper: { background: '#0b0e13', foreground: '#d6deeb', selectionBackground: '#2f4366' },
}

const host = ref(null)
let term = null
let fit = null
let observer = null
// 已经写进终端的文本，用来判断这次是追加还是整段换掉。
let written = ''

function themeFor(dark) {
  return dark ? THEMES.deeper : THEMES.normal
}

function rebuild(text) {
  term.reset()
  term.write(text || '', () => {
    if (term) term.scrollToBottom()
  })
}

function apply(text) {
  if (!term || text === written) return
  if (written && text.startsWith(written)) {
    const atBottom = term.buffer.active.viewportY >= term.buffer.active.baseY
    const delta = text.slice(written.length)
    written = text
    term.write(delta)
    if (atBottom) term.scrollToBottom()
    return
  }
  written = text
  rebuild(text)
}

// 有选中内容时 Ctrl+C / ⌘C 复制；没选中就交给终端。
function onKey(event) {
  if (event.type !== 'keydown' || event.altKey) return true
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'c') return true
  if (!term.hasSelection()) return true
  navigator.clipboard?.writeText(term.getSelection()).catch(() => {})
  return false
}

onMounted(() => {
  term = new Terminal({
    convertEol: true,
    disableStdin: true,
    cursorBlink: false,
    scrollback: 5000,
    fontFamily: 'Roboto, sans-serif',
    fontSize: 12,
    lineHeight: 1.3,
    theme: themeFor(props.dark),
  })
  fit = new FitAddon()
  term.loadAddon(fit)
  term.open(host.value)
  requestAnimationFrame(() => term && fit.fit())
  // Roboto 加载完之后再量一次，比例字体的列宽按真实字形算。
  document.fonts?.ready.then(() => {
    if (term) fit.fit()
  })
  observer = new ResizeObserver(() => {
    if (term) fit.fit()
  })
  observer.observe(host.value)
  term.attachCustomKeyEventHandler(onKey)
  apply(props.text || '')
})

watch(
  () => props.text,
  (text) => apply(text || ''),
)

watch(
  () => props.dark,
  (dark) => {
    if (term) term.options.theme = themeFor(dark)
  },
)

onBeforeUnmount(() => {
  if (observer) observer.disconnect()
  if (term) term.dispose()
  observer = null
  term = null
})
</script>

<template>
  <div ref="host" class="term" :class="{ deeper: dark }" />
</template>

<style scoped>
.term {
  height: 320px;
  padding: 8px;
  border-radius: 8px;
  overflow: hidden;
  background: #11151c;
}
.term.deeper {
  background: #0b0e13;
}
</style>
