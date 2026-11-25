<!--
 * @Author: Himmeltala
 * @Date: 2026-11-25 10:00:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-25 10:00:00
 * @FilePath: \idex\web\src\features\editor\components\MergeDiffEditor.vue
 * @Description: VS Code 式差异编辑器：左原始版本只读，右工作副本可编辑，支持并排与内联。
-->
<template>
  <div ref="host" class="merge-diff" />
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { basicSetup } from 'codemirror'
import { indentWithTab } from '@codemirror/commands'
import { indentUnit } from '@codemirror/language'
import { Compartment, EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { autocompletion, startCompletion } from '@codemirror/autocomplete'
import { lintGutter } from '@codemirror/lint'
import { MergeView, unifiedMergeView } from '@codemirror/merge'
import { symbolAt } from '@bash-scripts/web-shared'
import { handlerOf } from '../core/handlers/registry.js'
import { languageExtension } from '../core/languageExtension.js'
import { editorThemeExtensions } from '../core/themes.js'
import { mergeViewOptions, unifiedOptions } from '../core/mergeDiff.js'
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
  pushDiagnostics,
  resetViewScroll,
} from '../core/editorBase.js'

const props = defineProps({
  original: { type: String, default: '' },
  modelValue: { type: String, default: '' },
  path: { type: String, default: '' },
  writable: { type: Boolean, default: false },
  inline: { type: Boolean, default: false },
  collapse: { type: Boolean, default: false },
  theme: { type: String, default: 'auto' },
  minimap: { type: Boolean, default: false },
  markers: { type: Object, default: () => ({}) },
  complete: { type: Function, default: null },
  format: { type: Function, default: null },
  capabilities: { type: [Function, Object], default: () => ({}) },
  notice: { type: Function, default: null },
})

const emit = defineEmits([
  'update:modelValue',
  'edit',
  'definition',
  'hover',
  'hover-end',
])

const host = ref(null)
const merge = shallowRef(null)
const single = shallowRef(null)
const requests = latestRequests()
let debounceTimer = 0
let pendingResolve = null
let hoverTimer = 0
let hoverKey = ''
const appearance = new Compartment()
const minimapConf = new Compartment()

function activeView() {
  return merge.value ? merge.value.b : single.value
}

function capabilitiesOf() {
  const value = props.capabilities
  const caps = typeof value === 'function' ? value(props.path) : value
  return caps || {}
}

function currentText() {
  const view = activeView()
  return view ? view.state.doc.toString() : String(props.modelValue ?? '')
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
  const symbol = pos == null ? null : symbolAtOffset(pos)
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
    emit('definition', symbol)
    return true
  },
  mousemove: hoverAt,
  mouseleave() {
    endHover()
  },
})

function completeAt(args) {
  if (!props.complete) return Promise.resolve(null)
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
  const at = positionOfDoc(activeView().state.doc, context.pos)
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
  const view = activeView()
  if (!view || !props.writable) return
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
    // 区间重叠时保持原文。
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
]

const updateListener = EditorView.updateListener.of((update) => {
  if (update.docChanged) {
    const text = update.state.doc.toString()
    if (text !== props.modelValue) emit('update:modelValue', text)
    emit('edit')
  }
})

function editorExtensions(readonly) {
  const extensions = [
    basicSetup,
    appearance.of(editorThemeExtensions(props.theme)),
    minimapConf.of(readonly ? [] : minimapExtension(props.minimap)),
    indentUnit.of('    '),
    keymap.of(keys),
    lintGutter(),
    languageExtension(handlerOf(props.path).cmLanguage(props.path)),
    autocompletion({ override: [completionSource], activateOnTyping: true }),
    SEARCH_PHRASES,
  ]
  if (readonly) {
    extensions.push(EditorState.readOnly.of(true), EditorView.editable.of(false))
  } else {
    extensions.push(domEvents, updateListener)
  }
  return extensions
}

function destroy() {
  endHover()
  clearTimeout(debounceTimer)
  requests.cancel()
  if (pendingResolve) pendingResolve(null)
  merge.value?.destroy()
  single.value?.destroy()
  merge.value = null
  single.value = null
}

function captureState() {
  const view = activeView()
  if (!view) return null
  const selection = view.state.selection.main
  return {
    anchor: selection.anchor,
    head: selection.head,
    top: view.scrollDOM.scrollTop,
    left: view.scrollDOM.scrollLeft,
  }
}

function restoreState(state) {
  const view = activeView()
  if (!view || !state) return
  const length = view.state.doc.length
  view.dispatch({
    selection: { anchor: Math.min(state.anchor, length), head: Math.min(state.head, length) },
  })
  view.scrollDOM.scrollTop = state.top
  view.scrollDOM.scrollLeft = state.left
}

function build() {
  const state = captureState()
  destroy()
  if (!host.value) return
  const original = String(props.original ?? '')
  const modified = String(props.modelValue ?? '')
  if (props.inline) {
    single.value = new EditorView({
      parent: host.value,
      state: EditorState.create({
        doc: modified,
        extensions: [
          ...editorExtensions(!props.writable),
          unifiedMergeView({ original, ...unifiedOptions(props) }),
        ],
      }),
    })
  } else {
    const options = mergeViewOptions(props)
    merge.value = new MergeView({
      a: {
        doc: original,
        extensions: editorExtensions(true),
      },
      b: {
        doc: modified,
        extensions: editorExtensions(!props.writable),
      },
      parent: host.value,
          ...options,
    })
  }
  pushDiagnostics()
  if (state) requestAnimationFrame(() => restoreState(state))
}

onMounted(() => build())
onBeforeUnmount(destroy)

watch(
  () => [props.inline, props.collapse, props.writable, props.path],
  () => nextTick(build),
)
watch(
  () => props.original,
  () => nextTick(build),
)
watch(
  () => props.modelValue,
  (value) => {
    const view = activeView()
    if (!view) return
    const text = String(value ?? '')
    if (text === view.state.doc.toString()) return
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } })
    pushDiagnostics()
  },
)
watch(() => props.markers, pushDiagnostics)

function reconfigure(compartment, extension) {
  for (const view of merge.value ? [merge.value.a, merge.value.b] : single.value ? [single.value] : []) {
    view.dispatch({ effects: compartment.reconfigure(extension) })
  }
}

watch(
  () => props.theme,
  () => reconfigure(appearance, editorThemeExtensions(props.theme)),
)
watch(
  () => props.minimap,
  () => {
    const views = merge.value ? [merge.value.b] : single.value ? [single.value] : []
    for (const view of views) {
      view.dispatch({ effects: minimapConf.reconfigure(minimapExtension(props.minimap)) })
    }
  },
)

function locate(line) {
  locateInView(activeView(), line)
}

function resetScroll() {
  resetViewScroll(activeView())
}

defineExpose({ locate, resetScroll })
</script>

<style scoped>
.merge-diff {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  overflow: hidden;
}
.merge-diff :deep(.cm-mergeView) {
  flex: 1 1 auto;
  height: 100%;
  overflow: auto;
}
.merge-diff :deep(.cm-mergeViewEditors) {
  flex: 1 1 auto;
}
.merge-diff :deep(.cm-editor) {
  height: 100%;
}
</style>
