<template>
  <div ref="host" class="cm-host" />
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { basicSetup } from 'codemirror'
import { Compartment, EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { indentWithTab } from '@codemirror/commands'
import { indentUnit } from '@codemirror/language'
import { autocompletion, startCompletion } from '@codemirror/autocomplete'
import { lintGutter, setDiagnostics } from '@codemirror/lint'
import { symbolAt } from '@bash-scripts/web-shared'
import { cmLanguageOf, languageExtension } from './languages.js'
import {
  completionAnchor,
  completionOptions,
  latestRequests,
  snapshotMatches,
} from './completion.js'
import { offsetAt } from './positions.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
  path: { type: String, default: '' },
  markers: { type: Object, default: () => ({}) },
  complete: { type: Function, default: null },
  format: { type: Function, default: null },
  capabilities: { type: [Function, Object], default: () => ({}) },
  notice: { type: Function, default: null },
})

const emit = defineEmits(['update:modelValue', 'symbol', 'menu', 'rename', 'caret', 'edit', 'hover', 'hover-end'])

const host = ref(null)
const language = new Compartment()
const requests = latestRequests()
let view = null
let debounceTimer = 0
let pendingResolve = null
let hoverTimer = 0
let hoverKey = ''

const CODE_FONT = "'JetBrains Mono', Roboto, 'Noto Sans SC', 'Source Han Sans SC', monospace"

function capabilitiesOf() {
  const value = props.capabilities
  const caps = typeof value === 'function' ? value(props.path) : value
  return caps || {}
}

function currentText() {
  return view ? view.state.doc.toString() : String(props.modelValue ?? '')
}

function positionOf(offset) {
  const text = currentText()
  const safe = Math.max(0, Math.min(Number(offset) || 0, text.length))
  const before = text.slice(0, safe)
  const line = before.split('\n').length - 1
  return { line, character: safe - (before.lastIndexOf('\n') + 1), offset: safe }
}

function endHover() {
  clearTimeout(hoverTimer)
  if (hoverKey) {
    hoverKey = ''
    emit('hover-end')
  }
}

function symbolAtOffset(offset) {
  return symbolAt(currentText(), offset)
}

function hoverAt(event, editor) {
  if (event.buttons || event.ctrlKey || event.metaKey) {
    endHover()
    return
  }
  const pos = editor.posAtCoords({ x: event.clientX, y: event.clientY })
  if (pos == null) {
    endHover()
    return
  }
  const symbol = symbolAtOffset(pos)
  if (!symbol) {
    endHover()
    return
  }
  const key = `${symbol.line}:${symbol.character}`
  if (key === hoverKey) return
  clearTimeout(hoverTimer)
  if (hoverKey) {
    hoverKey = ''
    emit('hover-end')
  }
  const x = event.clientX
  const y = event.clientY
  hoverTimer = setTimeout(() => {
    hoverKey = key
    emit('hover', { ...symbol, x, y })
  }, 600)
}

const domEvents = EditorView.domEventHandlers({
  mousedown(event, editor) {
    if (!(event.ctrlKey || event.metaKey) || event.button !== 0) return false
    const pos = editor.posAtCoords({ x: event.clientX, y: event.clientY })
    const symbol = pos == null ? null : symbolAtOffset(pos)
    if (!symbol) return false
    event.preventDefault()
    emit('symbol', symbol)
    return true
  },
  contextmenu(event, editor) {
    const pos = editor.posAtCoords({ x: event.clientX, y: event.clientY })
    const symbol = pos == null ? null : symbolAtOffset(pos)
    if (!symbol) return false
    event.preventDefault()
    emit('menu', { ...symbol, x: event.clientX, y: event.clientY })
    return true
  },
  mousemove: hoverAt,
  mouseleave() {
    endHover()
  },
})

function completeAt(args) {
  if (!props.complete) return Promise.resolve(null)
  // 一有新的输入就让在途请求作废，哪怕防抖还没到点。
  requests.cancel()
  if (pendingResolve) {
    pendingResolve(null)
    pendingResolve = null
  }
  clearTimeout(debounceTimer)
  return new Promise((resolve) => {
    pendingResolve = resolve
    debounceTimer = setTimeout(async () => {
      pendingResolve = null
      try {
        resolve(await requests.run(() => props.complete(args)))
      } catch (err) {
        resolve(null)
      }
    }, 150)
  })
}

async function completionSource(context) {
  if (!capabilitiesOf().completion || !cmLanguageOf(props.path)) return null
  const text = currentText()
  const anchor = completionAnchor(text, context.pos)
  if (!context.explicit && (!anchor || (anchor.empty && !anchor.trigger))) return null
  const at = positionOf(context.pos)
  const data = await completeAt({
    path: props.path,
    text,
    line: at.line,
    character: at.character,
  })
  if (!data || !Array.isArray(data.items) || !data.items.length) return null
  return {
    from: anchor.from,
    options: completionOptions(data.items, text),
    validFor: /[\p{L}\p{N}_$@.-]*/u,
  }
}

function notify(text) {
  if (props.notice) props.notice(text)
}

async function formatDocument() {
  if (!view) return
  if (!capabilitiesOf().formatting) {
    notify('当前语言服务器不支持格式化')
    return
  }
  if (!props.format) return
  const text = currentText()
  let data = null
  try {
    data = await props.format({ path: props.path, text })
  } catch (err) {
    notify(`格式化失败：${err && err.message ? err.message : '服务端没有响应'}`)
    return
  }
  if (!snapshotMatches(view.state.doc.toString(), text)) return
  if (!data || !Array.isArray(data.edits) || !data.edits.length) return
  const changes = data.edits
    .map((edit) => ({
      from: offsetAt(text, edit.start.line, edit.start.character),
      to: offsetAt(text, edit.end.line, edit.end.character),
      insert: String(edit.newText ?? ''),
    }))
    .sort((left, right) => left.from - right.from || left.to - right.to)
  try {
    view.dispatch({ changes })
  } catch (err) {
    // 服务器给的改动区间重叠时不落盘，保持原文。
  }
}

const keys = [
  indentWithTab,
  { key: 'Mod-Space', run: startCompletion },
  {
    key: 'Shift-Alt-f',
    run() {
      formatDocument()
      return true
    },
  },
  {
    key: 'F2',
    run(editor) {
      const symbol = symbolAtOffset(editor.state.selection.main.head)
      if (!symbol) return false
      emit('rename', symbol)
      return true
    },
  },
]

const theme = EditorView.theme({
  '&': {
    height: '100%',
    color: 'rgb(var(--v-theme-on-surface))',
    backgroundColor: 'rgb(var(--v-theme-surface))',
  },
  '.cm-scroller': {
    fontFamily: CODE_FONT,
    fontSize: '0.86rem',
    lineHeight: '1.6',
  },
  '.cm-content': { caretColor: 'rgb(var(--v-theme-on-surface))' },
  '.cm-gutters': {
    backgroundColor: 'rgb(var(--v-theme-surface))',
    color: 'rgb(var(--v-theme-on-surface-variant))',
    borderRight: '1px solid rgba(var(--v-theme-on-surface), 0.08)',
  },
  '.cm-activeLine': { backgroundColor: 'rgba(var(--v-theme-primary), 0.1)' },
  '.cm-activeLineGutter': { backgroundColor: 'rgba(var(--v-theme-primary), 0.06)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'rgba(var(--v-theme-primary), 0.28)',
  },
  '.cm-tooltip': {
    border: '1px solid rgba(var(--v-theme-on-surface), 0.12)',
    backgroundColor: 'rgb(var(--v-theme-surface))',
  },
})

const phrases = EditorState.phrases.of({
  Find: '查找',
  Replace: '替换',
  next: '下一个',
  previous: '上一个',
  all: '全部',
  'match case': '区分大小写',
  regexp: '正则表达式',
  'by word': '整词',
  replace: '替换',
  'replace all': '全部替换',
  close: '关闭',
})

const updateListener = EditorView.updateListener.of((update) => {
  if (update.docChanged) {
    const text = update.state.doc.toString()
    if (text !== props.modelValue) emit('update:modelValue', text)
    emit('edit')
  }
  if (update.docChanged || update.selectionSet) {
    const at = positionOf(update.state.selection.main.head)
    emit('caret', { line: at.line + 1, column: at.character + 1 })
  }
})

function pushDiagnostics() {
  if (!view) return
  const doc = view.state.doc
  const items = []
  for (const [key, level] of Object.entries(props.markers || {})) {
    const number = Number(key)
    if (!Number.isInteger(number) || number < 1 || number > doc.lines) continue
    const line = doc.line(number)
    items.push({
      from: line.from,
      to: line.to,
      severity: level === 'error' ? 'error' : level === 'warning' ? 'warning' : 'info',
      message: '',
    })
  }
  view.dispatch(setDiagnostics(view.state, items))
}

function buildExtensions() {
  return [
    basicSetup,
    theme,
    indentUnit.of('    '),
    keymap.of(keys),
    lintGutter(),
    language.of(languageExtension(cmLanguageOf(props.path))),
    autocompletion({ override: [completionSource], activateOnTyping: true }),
    domEvents,
    updateListener,
    phrases,
  ]
}

onMounted(() => {
  view = new EditorView({
    parent: host.value,
    state: EditorState.create({ doc: String(props.modelValue ?? ''), extensions: buildExtensions() }),
  })
  pushDiagnostics()
})

onBeforeUnmount(() => {
  clearTimeout(debounceTimer)
  clearTimeout(hoverTimer)
  requests.cancel()
  if (pendingResolve) pendingResolve(null)
  view?.destroy()
  view = null
})

watch(
  () => props.modelValue,
  (value) => {
    if (!view) return
    const text = String(value ?? '')
    if (text === view.state.doc.toString()) return
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } })
  }
)

watch(
  () => props.path,
  () => {
    if (!view) return
    view.dispatch({
      effects: language.reconfigure(languageExtension(cmLanguageOf(props.path))),
    })
  }
)

watch(() => props.markers, pushDiagnostics, { deep: true })

function locate(line) {
  if (!view) return
  const number = Math.min(Math.max(Number(line) || 1, 1), view.state.doc.lines)
  const target = view.state.doc.line(number)
  view.focus()
  view.dispatch({
    selection: { anchor: target.from, head: target.to },
    effects: EditorView.scrollIntoView(target.from, { y: 'start' }),
  })
}

function resetScroll() {
  if (!view) return
  view.scrollDOM.scrollTop = 0
  view.scrollDOM.scrollLeft = 0
}

defineExpose({ locate, resetScroll })
</script>

<style scoped>
.cm-host {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}
</style>
