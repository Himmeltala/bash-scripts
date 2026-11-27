<!--
 * @Author: Himmeltala
 * @Date: 2026-11-21 20:04:21
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-25 09:19:47
 * @FilePath: \idex\web\src\features\editor\components\CodeMirrorEditor.vue
 * @Description: 基于 CodeMirror 6 的代码编辑器：补全、格式化、悬停、诊断与 Git 行级标记。
-->
<template>
  <div class="cm-shell">
    <div ref="host" class="cm-host" />
    <EditorFindBar :controller="findCtl" />
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { editorSetup } from '../core/setup.js'
import { foldEffect, unfoldEffect } from '@codemirror/language'
import { Compartment, EditorState, Prec, StateEffect } from '@codemirror/state'
import { EditorView, GutterMarker, gutter, keymap } from '@codemirror/view'
import { indentWithTab } from '@codemirror/commands'
import { indentUnit } from '@codemirror/language'
import { autocompletion, startCompletion } from '@codemirror/autocomplete'
import { lintGutter, setDiagnostics } from '@codemirror/lint'
import { search } from '@codemirror/search'
import { symbolAt } from '@bash-scripts/web-shared'
import { handlerOf } from '../core/handlers/registry.js'
import { languageExtension } from '../core/languageExtension.js'
import { editorThemeExtensions } from '../core/themes.js'
import {
  completionAnchor,
  completionOptions,
  latestRequests,
  snapshotMatches,
} from '../core/completion.js'
import {
  SEARCH_PHRASES,
  formatChanges,
  locateInView,
  minimapExtension,
  positionOfDoc,
  pushDiagnostics as pushMarkers,
  resetViewScroll,
} from '../core/editorBase.js'
import { showMinimap } from '@replit/codemirror-minimap'
import { useShortcutBindings } from '../../settings/composables/useSettings'
import { toCmKey } from '../../settings/lib/shortcuts'
import { useEditorFind } from '../composables/useEditorFind.js'
import EditorFindBar from './EditorFindBar.vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  path: { type: String, default: '' },
  markers: { type: Object, default: () => ({}) },
  complete: { type: Function, default: null },
  format: { type: Function, default: null },
  capabilities: { type: [Function, Object], default: () => ({}) },
  notice: { type: Function, default: null },
  theme: { type: String, default: 'auto' },
  // 右侧代码地图；设置里开关，切换时重配置。
  minimap: { type: Boolean, default: false },
  // 需要折叠的行区间（1 起、含两端），用来只显示差异附近。
  collapsedRanges: { type: Array, default: () => [] },
  // 各文件的 Git 行级标记：{ 路径: { marks: { 行号: { kind, hunk } }, hunks: [] } }。
  diff: { type: Object, default: () => ({}) },
})

const emit = defineEmits([
  'update:modelValue',
  'symbol',
  'menu',
  'rename',
  'caret',
  'edit',
  'hover',
  'hover-end',
  'diffhunk',
])

const shortcuts = useShortcutBindings()
const host = ref(null)
const language = new Compartment()
const appearance = new Compartment()
const minimapConf = new Compartment()
const keymapConf = new Compartment()
const requests = latestRequests()
let view = null
let foldedRanges = []
let debounceTimer = 0
let pendingResolve = null
let hoverTimer = 0
let hoverKey = ''

function capabilitiesOf() {
  const value = props.capabilities
  const caps = typeof value === 'function' ? value(props.path) : value
  return caps || {}
}

function currentText() {
  return view ? view.state.doc.toString() : String(props.modelValue ?? '')
}

function positionOf(offset) {
  return view
    ? positionOfDoc(view.state.doc, offset)
    : { line: 0, character: 0, offset: 0 }
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
  if (!capabilitiesOf().completion || !handlerOf(props.path).cmLanguage(props.path)) return null
  const text = currentText()
  const anchor = completionAnchor(text, context.pos)
  if (!context.explicit && (!anchor || (anchor.empty && !anchor.trigger))) return null
  const at = positionOf(context.pos)
  const data = await completeAt({
    path: props.path,
    text,
    line: at.line,
    character: at.character,
    trigger: anchor.triggerChar,
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
  const changes = formatChanges(text, data.edits)
  try {
    view.dispatch({ changes })
  } catch (err) {
    // 服务器给的改动区间重叠时不落盘，保持原文。
  }
}

// 编辑器查找：设置里的组合与 Esc 优先于 CodeMirror 自带的查找面板。
const findCtl = useEditorFind(() => view)

function findKeys() {
  const keys = []
  const open = toCmKey(shortcuts.value.editorFind)
  if (open) {
    keys.push({
      key: open,
      run() {
        findCtl.open()
        return true
      },
    })
  }
  keys.push({
    key: 'Escape',
    run() {
      if (!findCtl.find.open) return false
      findCtl.close()
      return true
    },
  })
  return keys
}

// 绑定从设置里读；改完设置重配置，旧的组合不再拦截。
function editorKeys() {
  const keys = shortcuts.value
  const bindings = [indentWithTab]
  const complete = toCmKey(keys.complete)
  if (complete) bindings.push({ key: complete, run: startCompletion })
  const format = toCmKey(keys.format)
  if (format) {
    bindings.push({
      key: format,
      run() {
        formatDocument()
        return true
      },
    })
  }
  const rename = toCmKey(keys.rename)
  if (rename) {
    bindings.push({
      key: rename,
      run(editor) {
        const symbol = symbolAtOffset(editor.state.selection.main.head)
        if (!symbol) return false
        emit('rename', symbol)
        return true
      },
    })
  }
  return bindings
}

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

class DiffMarker extends GutterMarker {
  constructor(kind) {
    super()
    this.kind = kind
  }

  toDOM() {
    const el = document.createElement('span')
    el.className = `cm-diff-mark ${this.kind}`
    return el
  }
}

const DIFF_MARKERS = {
  add: new DiffMarker('add'),
  modify: new DiffMarker('modify'),
  delete: new DiffMarker('delete'),
}

function diffEntry() {
  return (props.diff && props.diff[props.path]) || null
}

function minimapMarks() {
  const entry = diffEntry()
  return (entry && entry.marks) || {}
}

function diffGutter() {
  return gutter({
    class: 'cm-diff-gutter',
    lineMarker(editor, block) {
      const entry = diffEntry()
      if (!entry || !entry.marks) return null
      const number = editor.state.doc.lineAt(block.from).number
      const mark = entry.marks[number]
      return mark ? DIFF_MARKERS[mark.kind] || null : null
    },
    domEventHandlers: {
      mousedown(editor, block, event) {
        const entry = diffEntry()
        if (!entry || !entry.marks) return false
        const number = editor.state.doc.lineAt(block.from).number
        const mark = entry.marks[number]
        if (!mark) return false
        event.preventDefault()
        emit('diffhunk', {
          line: number,
          hunk: (entry.hunks || [])[mark.hunk] || null,
          x: event.clientX,
          y: event.clientY,
        })
        return true
      },
    },
  })
}

function buildExtensions() {
  return [
    editorSetup,
    search(),
    appearance.of(editorThemeExtensions(props.theme)),
    minimapConf.of(minimapExtension(props.minimap, minimapMarks())),
    indentUnit.of('    '),
    keymapConf.of([Prec.high(keymap.of(findKeys())), keymap.of(editorKeys())]),
    lintGutter(),
    diffGutter(),
    language.of(languageExtension(handlerOf(props.path).cmLanguage(props.path))),
    autocompletion({ override: [completionSource], activateOnTyping: true }),
    domEvents,
    updateListener,
    SEARCH_PHRASES,
  ]
}

onMounted(() => {
  view = new EditorView({
    parent: host.value,
    state: EditorState.create({ doc: String(props.modelValue ?? ''), extensions: buildExtensions() }),
  })
  pushMarkers(view, props.markers)
  setCollapsedRanges(props.collapsedRanges)
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
  () => props.theme,
  () => {
    if (!view) return
    view.dispatch({ effects: appearance.reconfigure(editorThemeExtensions(props.theme)) })
  }
)

watch(
  () => props.collapsedRanges,
  (ranges) => setCollapsedRanges(ranges),
  { deep: true },
)

watch(
  shortcuts,
  () => {
    if (!view) return
    view.dispatch({
      effects: keymapConf.reconfigure([Prec.high(keymap.of(findKeys())), keymap.of(editorKeys())]),
    })
  },
  { deep: true },
)

watch(
  () => props.minimap,
  () => {
    if (!view) return
    view.dispatch({
      effects: minimapConf.reconfigure(minimapExtension(props.minimap, minimapMarks())),
    })
  }
)

watch(
  () => props.path,
  () => {
    if (!view) return
    view.dispatch({
      effects: [
        language.reconfigure(languageExtension(handlerOf(props.path).cmLanguage(props.path))),
        minimapConf.reconfigure(minimapExtension(props.minimap, minimapMarks())),
      ],
    })
  }
)

watch(() => props.markers, () => pushMarkers(view, props.markers), { deep: true })

// 换文件或重新取到差异后，让边栏按新标记重画一次。
const refreshDiff = StateEffect.define()
watch(
  () => props.diff,
  () => {
    if (!view) return
    view.dispatch({
      effects: [
        refreshDiff.of(null),
        minimapConf.reconfigure(minimapExtension(props.minimap, minimapMarks())),
      ],
    })
  }
)

function locate(line) {
  locateInView(view, line)
}

function resetScroll() {
  resetViewScroll(view)
}

// 折叠一组行区间（1 起、含两端），用来只显示差异附近的代码；LSP 行号不受影响。
function setCollapsedRanges(ranges) {
  if (!view) return
  const effects = []
  for (const range of foldedRanges) effects.push(unfoldEffect.of(range))
  foldedRanges = []
  const doc = view.state.doc
  for (const [start, end] of ranges || []) {
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue
    const a = Math.max(1, Math.trunc(start))
    const b = Math.min(doc.lines, Math.trunc(end))
    if (b <= a) continue
    const range = { from: doc.line(a).from, to: doc.line(b).to }
    effects.push(foldEffect.of(range))
    foldedRanges.push(range)
  }
  view.dispatch({ effects })
}

defineExpose({ locate, resetScroll, setCollapsedRanges })
</script>

<style scoped>
/* 缩略图画布由扩展自己排版，这里只定宽高。 */
:deep(.cm-minimap-box) {
  width: 72px;
  height: 100%;
}
.cm-shell {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
}
.cm-host {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

:deep(.cm-diff-gutter) {
  width: 7px;
  cursor: pointer;
}

:deep(.cm-diff-mark) {
  display: block;
  width: 4px;
  height: 100%;
  margin: 0 auto;
  border-radius: 1px;
}

:deep(.cm-diff-mark.add) {
  background: #2e7d32;
}

:deep(.cm-diff-mark.modify) {
  background: #1565c0;
}

:deep(.cm-diff-mark.delete) {
  background: #c62828;
}
</style>
