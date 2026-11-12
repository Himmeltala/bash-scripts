<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { colorize } from '../composables/logColor'

const props = defineProps({
  text: { type: String, default: '' },
  dark: { type: Boolean, default: false },
})

// 两种深色底，与原来日志区的底色一致；浅色主题下也用深底，终端习惯如此。
const THEMES = {
  normal: { background: '#11151c', foreground: '#d6deeb', selectionBackground: '#2f4366' },
  deeper: { background: '#0b0e13', foreground: '#d6deeb', selectionBackground: '#2f4366' },
}

const host = ref(null)
let term = null
let fit = null
let observer = null
// 已经画进终端的文本，用来判断这次是追加、前面补页还是整段换掉。
let written = ''

function themeFor(dark) {
  return dark ? THEMES.deeper : THEMES.normal
}

// 重建整屏：清空后写全量，写完把视口放到指定行；不指定就停在最新一行。
function rebuild(text, keepLine) {
  term.reset()
  term.write(colorize(text), () => {
    if (!term) return
    if (keepLine == null) term.scrollToBottom()
    else term.scrollToLine(Math.min(keepLine, Math.max(0, term.buffer.active.length - 1)))
  })
}

function apply(text) {
  if (!term || text === written) return
  // 末尾多了内容：只写增量，读日志时滚上去的视口不会被拽回底部。
  if (written && text.startsWith(written)) {
    const atBottom = term.buffer.active.viewportY >= term.buffer.active.baseY
    const delta = text.slice(written.length)
    written = text
    term.write(colorize(delta))
    if (atBottom) term.scrollToBottom()
    return
  }
  // 前面补进了更早的一页：按新增行数下移视口，停在同一段内容上。
  if (written && text.endsWith(written)) {
    const older = text.slice(0, text.length - written.length)
    const added = (older.match(/\n/g) || []).length
    const keep = term.buffer.active.viewportY + added
    written = text
    rebuild(text, keep)
    return
  }
  written = text
  rebuild(text)
}

// 有选中内容时 Ctrl+C / ⌘C 复制；没选中就交给终端，不做别的。
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
  // 弹窗有展开动画，等一帧再按实际宽度算行列。
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
