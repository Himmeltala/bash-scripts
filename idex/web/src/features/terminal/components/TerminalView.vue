<!--
 * @Author: Himmeltala
 * @Date: 2026-11-25 00:00:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-25 00:00:00
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

const props = defineProps({
  session: { type: Object, required: true },
  active: { type: Boolean, default: false },
})

const wrap = ref(null)
const findInput = ref(null)
const find = reactive({ on: false, text: '', missing: false })
const theme = useTheme()
let observer = null
let fitTimer = 0

function terminalTheme() {
  if (theme.global.current.value.dark) {
    return {
      background: '#1e1e1e',
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
    background: '#ffffff',
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

function buildTerminal() {
  const term = new Terminal({
    allowProposedApi: true,
    cursorBlink: true,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 13,
    lineHeight: 1.15,
    scrollback: 5000,
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

// WebGL 只给当前可见的终端；隐藏或切换工作区时退回 canvas，省上下文。
function loadWebgl() {
  const slot = props.session
  if (!props.active || slot.webgl || !slot.term) return
  try {
    const addon = new WebglAddon()
    addon.onContextLoss(() => {
      try { addon.dispose() } catch (err) { /* 已释放 */ }
      slot.webgl = null
    })
    slot.term.loadAddon(addon)
    slot.webgl = markRaw(addon)
  } catch (err) {
    slot.webgl = null
  }
}

function unloadWebgl() {
  if (!props.session.webgl) return
  try { props.session.webgl.dispose() } catch (err) { /* 已释放 */ }
  props.session.webgl = null
}

function connect() {
  if (props.session.conn) return
  props.session.conn = connectTerminal(props.session, {
    onData: (seq, data) => {
      props.session.term?.write(data, () => props.session.conn?.ack(seq))
    },
    onExit: () => {
      props.session.term?.write('\r\n\x1b[2m[进程已结束]\x1b[0m\r\n')
    },
    onError: (message) => {
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
  unloadWebgl()
  // DOM 与连接都留在 store 里，切工作区回来接着用；关闭终端时才 dispose。
  if (props.session.el && props.session.el.parentNode === wrap.value) {
    wrap.value.removeChild(props.session.el)
  }
})

watch(
  () => props.active,
  (on) => {
    if (!on) {
      unloadWebgl()
      return
    }
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
