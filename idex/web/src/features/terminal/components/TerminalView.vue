<!--
 * @Author: Himmeltala
 * @Date: 2026-11-25 00:00:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-26 12:05:00
 * @FilePath: \idex\web\src\features\terminal\components\TerminalView.vue
 * @Description: 单个终端的 xterm 宿主；切走后保留实例与 DOM，切回来重新挂上。
-->
<template>
  <div ref="wrap" class="term-view" @mouseup="focusTerm">
    <div v-if="find.on" class="term-find">
      <v-text-field
        ref="findInput"
        v-model="find.text"
        density="compact"
        variant="outlined"
        hide-details
        placeholder="在终端中查找"
        class="find-input"
        @update:model-value="searchNext"
        @keydown.enter.prevent="searchNext"
        @keydown.esc.prevent="closeFind"
      />
      <span class="find-count" :class="{ bad: find.missing }">{{ find.missing ? '没找到' : '' }}</span>
      <v-btn icon size="x-small" variant="text" title="上一个" @click="searchPrev">
        <v-icon size="16">mdi-chevron-up</v-icon>
      </v-btn>
      <v-btn icon size="x-small" variant="text" title="下一个" @click="searchNext">
        <v-icon size="16">mdi-chevron-down</v-icon>
      </v-btn>
      <v-btn icon size="x-small" variant="text" title="关闭（Esc）" @click="closeFind">
        <v-icon size="16">mdi-close</v-icon>
      </v-btn>
    </div>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { markRaw } from 'vue'
import { useTheme } from 'vuetify'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import { ClipboardAddon } from '@xterm/addon-clipboard'
import { SearchAddon } from '@xterm/addon-search'
import { WebglAddon } from '@xterm/addon-webgl'
import '@xterm/xterm/css/xterm.css'
import { encodeInput } from '../lib/protocol'
import { connectTerminal } from '../composables/useTerminalConnection'
import { terminalOptions } from '../lib/options'
import { dropWebgl, holdWebgl } from '../lib/webglCache'
import { usePreferencesStore } from '../../../stores/preferences'

const props = defineProps({
  session: { type: Object, required: true },
  active: { type: Boolean, default: false },
})

const wrap = ref(null)
const findInput = ref(null)
const find = reactive({ on: false, text: '', missing: false })
const theme = useTheme()
const preferences = usePreferencesStore()
let observer = null
let fitTimer = 0

// 输出先攒着，一帧或一批再写进 xterm；确认也攒着发，别让每个块都占一条消息。
const FLUSH_BYTES = 256 * 1024
const ACK_DELAY = 120
const ACK_BYTES = 256 * 1024
let writeQueue = []
let writeBytes = 0
let writeRaf = 0
let writeTimer = 0
let latestSeq = 0
let ackSeq = 0
let ackSent = 0
let ackBytes = 0
let ackTimer = 0

// 终端底色跟应用卡片用同一个 surface，深浅色切换和主题配色都以 Vuetify 为准。
function surfaceColor() {
  const colors = theme.global.current.value.colors || {}
  return colors.surface || (theme.global.current.value.dark ? '#121212' : '#ffffff')
}

function terminalTheme() {
  if (theme.global.current.value.dark) {
    return {
      background: surfaceColor(),
      foreground: '#d4d4d4',
      cursor: '#d4d4d4',
      selectionBackground: '#264f78',
      black: '#000000',
      red: '#cd3131',
      green: '#0dbc79',
      yellow: '#e5e510',
      blue: '#2472c8',
      magenta: '#bc3fbc',
      cyan: '#11a8cd',
      white: '#e5e5e5',
    }
  }
  return {
    background: surfaceColor(),
    foreground: '#333333',
    cursor: '#333333',
    selectionBackground: '#add6ff',
    black: '#000000',
    red: '#cd3131',
    green: '#00bc00',
    yellow: '#949800',
    blue: '#0451a5',
    magenta: '#bc05bc',
    cyan: '#0598bc',
    white: '#555555',
  }
}

// xterm 在 canvas 里画字，读不到 CSS 变量，先把字体栈和字号取成具体的值。
function codeFont() {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--bash-font-mono')
  return value.trim() || 'monospace'
}

function codeSize() {
  const root = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  const rem = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bash-code-size'))
  return Math.round(root * (rem || 0.86) * 100) / 100
}

// 终端外观按设置来；字体名换了也保留代码字体那串中文回退。
function appearance() {
  return terminalOptions(preferences.terminal, { font: codeFont(), size: codeSize() })
}

function buildTerminal() {
  const term = new Terminal({
    ...appearance(),
    allowProposedApi: true,
    theme: terminalTheme(),
  })
  const fit = new FitAddon()
  term.loadAddon(fit)
  term.loadAddon(new WebLinksAddon())
  term.loadAddon(new Unicode11Addon())
  term.loadAddon(new ClipboardAddon())
  term.unicode.activeVersion = '11'
  const search = new SearchAddon()
  term.loadAddon(search)

  const el = document.createElement('div')
  el.className = 'term-canvas'
  // 动态建的节点拿不到 scoped 的 data-v 属性，宽高直接写在行内。
  el.style.width = '100%'
  el.style.height = '100%'
  wrap.value.appendChild(el)
  term.open(el)

  term.onData((data) => props.session.conn?.sendInput(encodeInput(data)))
  term.onResize(({ cols, rows }) => props.session.conn?.resize(cols, rows))
  term.attachCustomKeyEventHandler((event) => {
    if (event.type !== 'keydown') return true
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
      event.preventDefault()
      openFind()
      return false
    }
    if (event.key === 'Escape' && find.on) {
      closeFind()
      return false
    }
    return true
  })

  props.session.term = markRaw(term)
  props.session.fit = markRaw(fit)
  props.session.search = markRaw(search)
  props.session.el = el
}

// WebGL 上下文有限：共享队列保留最近看过的几个终端，来回切标签不用反复建销。
function releaseWebgl(slot) {
  dropWebgl(slot)
  if (!slot.webgl) return
  try { slot.webgl.dispose() } catch (err) { /* 已释放 */ }
  slot.webgl = null
}

function loadWebgl() {
  const slot = props.session
  if (!props.active || !slot.term) return
  if (!slot.webgl) {
    let addon = null
    try {
      addon = new WebglAddon()
      addon.onContextLoss(() => {
        try { addon.dispose() } catch (err) { /* 已释放 */ }
        slot.webgl = null
        dropWebgl(slot)
      })
      slot.term.loadAddon(addon)
      slot.webgl = markRaw(addon)
    } catch (err) {
      // 建了但挂不上去时把上下文还回去，别把有限的上下文占死。
      if (addon) {
        try { addon.dispose() } catch (e) { /* 已释放 */ }
      }
      slot.webgl = null
    }
  }
  for (const old of holdWebgl(slot)) releaseWebgl(old)
}

function unloadWebgl() {
  releaseWebgl(props.session)
}

// 攒够一批或到了下一帧就合并写入一次；隐藏页签用定时器，别让后台终端把输出一直压着。
function scheduleFlush() {
  // 隐藏页签里 rAF 不跑，已经挂着的那一帧要撤掉换定时器，否则输出永远等不到刷新。
  if (document.hidden) {
    if (writeRaf) {
      cancelAnimationFrame(writeRaf)
      writeRaf = 0
    }
    if (!writeTimer) writeTimer = setTimeout(flushWrites, 50)
    return
  }
  if (writeRaf || writeTimer) return
  if (writeBytes >= FLUSH_BYTES) {
    writeTimer = setTimeout(flushWrites, 0)
    return
  }
  writeRaf = requestAnimationFrame(flushWrites)
}

function flushWrites() {
  if (writeRaf) {
    cancelAnimationFrame(writeRaf)
    writeRaf = 0
  }
  if (writeTimer) {
    clearTimeout(writeTimer)
    writeTimer = 0
  }
  if (!writeQueue.length) return
  const total = writeBytes
  const merged = new Uint8Array(total)
  let at = 0
  for (const part of writeQueue) {
    merged.set(part, at)
    at += part.byteLength
  }
  const seq = latestSeq
  writeQueue = []
  writeBytes = 0
  try {
    props.session.term?.write(merged, () => collectAck(seq, total))
  } catch (err) {
    // 终端已经销毁时丢掉这批，不影响其它标签。
  }
}

// 确认只报最大序号：服务端按序号把前面的块一起回收。
function collectAck(seq, bytes) {
  if (seq > ackSeq) ackSeq = seq
  ackBytes += bytes
  if (ackBytes >= ACK_BYTES) {
    sendAck()
    return
  }
  if (!ackTimer) ackTimer = setTimeout(sendAck, ACK_DELAY)
}

function sendAck() {
  if (ackTimer) {
    clearTimeout(ackTimer)
    ackTimer = 0
  }
  if (ackSeq <= ackSent) return
  ackSent = ackSeq
  ackBytes = 0
  props.session.conn?.ack(ackSeq)
}

function connect() {
  if (props.session.conn) return
  props.session.conn = connectTerminal(props.session, {
    onData: (seq, data) => {
      latestSeq = seq
      writeQueue.push(data)
      writeBytes += data.byteLength
      scheduleFlush()
    },
    // 退出提示要排在最后一批输出之后，先把攒着的写完。
    onExit: () => {
      flushWrites()
      props.session.term?.write('\r\n\x1b[2m[进程已结束]\x1b[0m\r\n')
    },
    onError: (message) => {
      flushWrites()
      props.session.term?.write(`\r\n\x1b[31m${message}\x1b[0m\r\n`)
    },
  })
}

function openFind() {
  find.on = true
  nextTick(() => {
    const field = findInput.value && findInput.value.$el
    const input = field && field.querySelector('input')
    if (input) {
      input.focus()
      input.select()
    }
  })
}

function searchNext() {
  if (!props.session.search || !find.text) {
    find.missing = false
    return
  }
  find.missing = !props.session.search.findNext(find.text, { caseSensitive: false })
}

function searchPrev() {
  if (!props.session.search || !find.text) return
  find.missing = !props.session.search.findPrevious(find.text, { caseSensitive: false })
}

function closeFind() {
  find.on = false
  find.missing = false
  props.session.term?.focus()
}

function fit() {
  const el = wrap.value
  if (!el || !props.session.fit || el.clientWidth < 40 || el.clientHeight < 30) return
  props.session.fit.fit()
}

function scheduleFit() {
  clearTimeout(fitTimer)
  fitTimer = setTimeout(fit, 60)
}

function focusTerm() {
  if (props.active) props.session.term?.focus()
}

onMounted(() => {
  if (props.session.term) {
    if (props.session.el) wrap.value.appendChild(props.session.el)
  } else {
    buildTerminal()
  }
  nextTick(() => {
    fit()
    connect()
    loadWebgl()
    if (props.active) props.session.term?.focus()
  })
  observer = new ResizeObserver(scheduleFit)
  observer.observe(wrap.value)
})

onBeforeUnmount(() => {
  clearTimeout(fitTimer)
  observer?.disconnect()
  observer = null
  // 切组或关标签前把攒着的输出写完，缓冲和历史不丢。
  flushWrites()
  sendAck()
  unloadWebgl()
  // DOM 与连接都留在 store 里，切工作区回来接着用；关闭终端时才 dispose。
  if (props.session.el && props.session.el.parentNode === wrap.value) {
    wrap.value.removeChild(props.session.el)
  }
})

// 切走不立刻释放上下文：最近几个终端的 WebGL 留着，切回来不重建；超出保留数由 keepWebgl 淘汰。
watch(
  () => props.active,
  (on) => {
    if (!on) return
    nextTick(() => {
      fit()
      loadWebgl()
      props.session.term?.focus()
    })
  },
)

watch(
  () => theme.global.current.value.dark,
  () => {
    if (props.session.term) props.session.term.options.theme = terminalTheme()
  },
)

// 设置里改终端外观后立即生效，字号变了要重新量一次宽度。
watch(
  () => preferences.terminal,
  () => {
    const term = props.session.term
    if (!term) return
    const next = appearance()
    for (const [key, value] of Object.entries(next)) term.options[key] = value
    nextTick(() => fit())
  },
  { deep: true },
)
</script>

<style scoped>
.term-view {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  padding: 4px 0 4px 6px;
  overflow: hidden;
}
.term-find {
  position: absolute;
  top: 8px;
  right: 22px;
  z-index: 6;
  display: flex;
  align-items: center;
  gap: 4px;
  width: min(380px, calc(100% - 44px));
  padding: 5px;
  border-radius: 8px;
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.24);
}
.find-input {
  flex: 1 1 auto;
  min-width: 0;
}
.find-count {
  flex: 0 0 auto;
  font-size: 0.72rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.find-count.bad {
  color: rgb(var(--v-theme-error));
}
:deep(.term-canvas) {
  width: 100%;
  height: 100%;
}
</style>
