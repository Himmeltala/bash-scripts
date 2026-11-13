<template>
  <div class="diff">
    <div v-if="title" class="head">
      <div class="headline">
        <span class="title mono" :title="title">{{ title }}</span>
        <v-chip v-if="kind === 'file' && labels.fileNote" size="x-small" variant="flat" color="unversioned">
          {{ labels.fileNote }}
        </v-chip>
        <v-chip v-if="truncated" size="x-small" variant="flat" color="modified">
          {{ labels.truncated }}
        </v-chip>
        <span v-if="readOnlyReason" class="readonly">{{ readOnlyReason }}</span>
      </div>
      <slot name="actions" />
    </div>

    <p v-if="loading" class="hint">{{ labels.loading }}</p>
    <p v-else-if="error" class="hint bad">{{ error }}</p>
    <div v-else-if="!viewRows.length" class="hint">{{ labels.empty }}</div>
    <div v-else class="body mono">
      <div v-for="item in viewRows" :key="item.key" class="row" :class="item.cls">
        <template v-if="item.kind === 'plain'">
          <template v-if="item.row.type === 'meta' || item.row.type === 'hunk'">
            <span class="wide">{{ item.row.text }}</span>
          </template>
          <template v-else>
            <span class="ln">{{ item.old }}</span>
            <span class="ln">{{ item.new }}</span>
            <span class="sign">{{ item.row.sign }}</span>
            <span class="text" v-html="item.row.html" />
          </template>
        </template>
        <template v-else>
          <span class="ln">{{ item.old }}</span>
          <span class="ln">{{ item.new }}</span>
          <span class="sign">{{ item.sign }}</span>
          <span
            v-if="item.line.id === activeId"
            :ref="(el) => bindLine(el, item)"
            class="text edit"
            contenteditable="true"
            spellcheck="false"
            @input="onInput(item, $event)"
            @keydown="onKeydown(item, $event)"
            @paste="onPaste(item, $event)"
          />
          <span
            v-else
            class="text edit-idle"
            v-html="item.line.html"
            @click="startEdit(item, $event)"
          />
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { MAX_HIGHLIGHT, highlightCode, languageOf } from '../../utils/highlight.js'

const props = defineProps({
  text: { type: String, default: '' },
  // diff 是按行拆开显示；file 表示整份文件内容，每行都按新增显示。
  kind: { type: String, default: 'diff' },
  title: { type: String, default: '' },
  path: { type: String, default: '' },
  truncated: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  // 给了工作副本快照就能在差异行里直接改；没给只能看。
  editable: { type: Boolean, default: false },
  baseText: { type: String, default: '' },
  readOnlyReason: { type: String, default: '' },
  texts: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['dirty'])

const DEFAULTS = {
  loading: '正在取差异…',
  empty: '这里没有可显示的内容。',
  truncated: '已截断',
  fileNote: '未纳入版本控制，显示文件内容',
}
const labels = computed(() => ({ ...DEFAULTS, ...props.texts }))

const language = computed(() => {
  const text = props.text || ''
  if (!text) return ''
  return text.split('\n').length <= 2000 && text.length <= MAX_HIGHLIGHT
    ? languageOf(props.path)
    : ''
})

// 把差异文本拆成带行号的行：左列是旧文件行号，右列是新文件行号。
const rows = computed(() => {
  const text = props.text || ''
  if (!text) return []
  const lines = text.split('\n')
  const lang = language.value
  const code = (row) => ({ ...row, html: highlightCode(row.text, lang) })
  const out = []
  let oldNo = 0
  let newNo = 0

  if (props.kind === 'file') {
    return lines.map((line, i) =>
      code({ type: 'add', sign: '+', old: '', new: i + 1, text: line }),
    )
  }

  for (const line of lines) {
    if (line.startsWith('Index: ') || line.startsWith('====') || line.startsWith('\\ ')) {
      out.push({ type: 'meta', text: line })
      continue
    }
    if (line.startsWith('---') || line.startsWith('+++')) {
      out.push({ type: 'meta', text: line })
      continue
    }
    if (line.startsWith('@@')) {
      const hit = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
      if (hit) {
        oldNo = Number(hit[1])
        newNo = Number(hit[2])
      }
      out.push({ type: 'hunk', text: line })
      continue
    }
    if (line.startsWith('+')) {
      out.push(code({ type: 'add', sign: '+', old: '', new: newNo++, text: line.slice(1) }))
      continue
    }
    if (line.startsWith('-')) {
      out.push(code({ type: 'del', sign: '-', old: oldNo++, new: '', text: line.slice(1) }))
      continue
    }
    if (line.startsWith(' ')) {
      out.push(code({ type: 'ctx', sign: '', old: oldNo++, new: newNo++, text: line.slice(1) }))
      continue
    }
    out.push({ type: 'meta', text: line })
  }
  return out
})

// 编辑按连续可改的行分段：每段对应工作副本里一段行号，写回时整段替换。
const baseLines = computed(() => props.baseText.replace(/\r\n?/g, '\n').split('\n'))
let lineSeq = 0
const lineEls = new Map()
const edits = {}
const regionOfRow = new Map()
const renderTick = ref(0)
const activeId = ref(0)
const dirty = ref(false)

const regionKey = (region) => `${region.start}:${region.end}`

const makeLine = (text) => ({ id: ++lineSeq, text, html: highlightCode(text, language.value) })

function setLineText(line, text) {
  line.text = text
  line.html = highlightCode(text, language.value)
}

const regions = computed(() => {
  regionOfRow.clear()
  const out = []
  let cur = null
  for (const row of rows.value) {
    if (row.type === 'add' || row.type === 'ctx') {
      if (cur && row.new === cur.end + 1) {
        cur.end = row.new
        cur.rows.push(row)
        regionOfRow.set(row, cur)
      } else {
        cur = { start: row.new, end: row.new, rows: [row] }
        out.push(cur)
        regionOfRow.set(row, cur)
      }
    } else {
      cur = null
    }
  }
  return out
})

function ensureRegion(region) {
  const key = regionKey(region)
  if (edits[key]) return edits[key]
  // 内容以工作副本快照为准，快照对不上行数时才退回差异里的文本。
  const fromBase = baseLines.value.slice(region.start - 1, region.end)
  const source = fromBase.length === region.rows.length ? fromBase : region.rows.map((row) => row.text)
  edits[key] = {
    start: region.start,
    end: region.end,
    base: [...source],
    lines: source.map(makeLine),
  }
  return edits[key]
}

// 渲染序列：可改的段整体换成可编辑的行，其余行照旧；行号随行数增减顺延。
const viewRows = computed(() => {
  renderTick.value
  regions.value
  const out = []
  const done = new Set()
  let delta = 0
  rows.value.forEach((row, i) => {
    const region = props.editable ? regionOfRow.get(row) : null
    if (region) {
      const key = regionKey(region)
      if (done.has(key)) return
      done.add(key)
      const entry = ensureRegion(region)
      entry.lines.forEach((line, index) => {
        const orig = region.rows[index]
        const sign = orig ? orig.sign : '+'
        out.push({
          kind: 'edit',
          key: 'e' + line.id,
          region: entry,
          index,
          line,
          old: index === 0 ? region.rows[0].old : '',
          new: region.start + index + delta,
          sign,
          cls: sign === '+' ? 'add' : 'ctx',
        })
      })
      delta += entry.lines.length - region.rows.length
      return
    }
    if (row.type === 'meta' || row.type === 'hunk') {
      out.push({ kind: 'plain', key: 'p' + i, row, cls: row.type })
      return
    }
    out.push({
      kind: 'plain',
      key: 'p' + i,
      row,
      cls: row.type,
      old: row.old,
      new: row.new === '' ? '' : row.new + delta,
    })
  })
  return out
})

function syncDirty() {
  let now = false
  for (const region of regions.value) {
    const entry = edits[regionKey(region)]
    if (!entry) continue
    if (entry.lines.length !== entry.base.length) {
      now = true
      break
    }
    if (entry.lines.some((line, i) => line.text !== entry.base[i])) {
      now = true
      break
    }
  }
  if (now === dirty.value) return
  dirty.value = now
  emit('dirty', now)
}

function bump(focus) {
  if (focus) activeId.value = focus.line.id
  renderTick.value += 1
  syncDirty()
  if (!focus) return
  nextTick(() => {
    const el = lineEls.get(focus.line.id)
    if (el) placeCaret(el, focus.offset)
  })
}

function bindLine(el, item) {
  if (!el) {
    lineEls.delete(item.line.id)
    return
  }
  lineEls.set(item.line.id, el)
  if (el.textContent !== item.line.text) el.textContent = item.line.text
}

function selectionSpan(el) {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount) return null
  const range = sel.getRangeAt(0)
  if (!el.contains(range.startContainer) || !el.contains(range.endContainer)) return null
  return { start: offsetOf(el, range.startContainer, range.startOffset), end: offsetOf(el, range.endContainer, range.endOffset) }
}

function offsetOf(el, node, offset) {
  const probe = document.createRange()
  probe.selectNodeContents(el)
  probe.setEnd(node, offset)
  return probe.toString().length
}

function caretAt(el, edge) {
  const span = selectionSpan(el)
  if (!span || span.start !== span.end) return false
  return edge === 'start' ? span.start === 0 : span.end === el.textContent.length
}

function pointOffset(event) {
  const row = event.currentTarget
  let node = null
  let offset = 0
  if (document.caretRangeFromPoint) {
    const range = document.caretRangeFromPoint(event.clientX, event.clientY)
    if (range) {
      node = range.startContainer
      offset = range.startOffset
    }
  } else if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(event.clientX, event.clientY)
    if (pos) {
      node = pos.offsetNode
      offset = pos.offset
    }
  }
  if (!row || !node || !row.contains(node)) return row ? row.textContent.length : 0
  const probe = document.createRange()
  probe.selectNodeContents(row)
  probe.setEnd(node, offset)
  return probe.toString().length
}

function placeCaret(el, offset) {
  el.focus()
  const sel = window.getSelection()
  if (!sel) return
  const range = document.createRange()
  const node = el.firstChild
  if (node && node.nodeType === Node.TEXT_NODE) {
    range.setStart(node, Math.min(offset, node.textContent.length))
  } else {
    range.setStart(el, 0)
  }
  range.collapse(true)
  sel.removeAllRanges()
  sel.addRange(range)
}

function startEdit(item, event) {
  // 拖选是在挑文本复制，不当成要改这一行。
  const sel = window.getSelection()
  if (sel && !sel.isCollapsed) return
  const offset = pointOffset(event)
  activeId.value = item.line.id
  nextTick(() => {
    const el = lineEls.get(item.line.id)
    if (el) placeCaret(el, offset)
  })
}

function onInput(item, event) {
  setLineText(item.line, event.target.textContent)
  syncDirty()
}

function onKeydown(item, event) {
  if (event.isComposing) return
  const el = event.target
  if (event.key === 'Enter') {
    event.preventDefault()
    const span = selectionSpan(el)
    const start = span ? span.start : el.textContent.length
    const text = el.textContent
    setLineText(item.line, text.slice(0, start))
    const next = makeLine(text.slice(start))
    item.region.lines.splice(item.index + 1, 0, next)
    bump({ line: next, offset: 0 })
    return
  }
  if (event.key === 'Backspace' && caretAt(el, 'start')) {
    event.preventDefault()
    if (item.index === 0) return
    const prev = item.region.lines[item.index - 1]
    const offset = prev.text.length
    setLineText(prev, prev.text + el.textContent)
    item.region.lines.splice(item.index, 1)
    bump({ line: prev, offset })
    return
  }
  if (event.key === 'Delete' && caretAt(el, 'end')) {
    if (item.index >= item.region.lines.length - 1) return
    event.preventDefault()
    const offset = el.textContent.length
    const next = item.region.lines[item.index + 1]
    setLineText(item.line, el.textContent + next.text)
    item.region.lines.splice(item.index + 1, 1)
    bump({ line: item.line, offset })
  }
}

function onPaste(item, event) {
  event.preventDefault()
  const text = event.clipboardData ? event.clipboardData.getData('text/plain') : ''
  if (!text) return
  const el = event.target
  const span = selectionSpan(el)
  const start = span ? span.start : el.textContent.length
  const end = span ? span.end : el.textContent.length
  const value = el.textContent
  const parts = text.replace(/\r\n?/g, '\n').split('\n')
  setLineText(item.line, value.slice(0, start) + parts[0])
  if (parts.length === 1) {
    setLineText(item.line, item.line.text + value.slice(end))
    el.textContent = item.line.text
    placeCaret(el, start + parts[0].length)
    syncDirty()
    return
  }
  const rest = parts.slice(1)
  const added = rest.map((part) => makeLine(part))
  added[added.length - 1].text += value.slice(end)
  added[added.length - 1].html = highlightCode(added[added.length - 1].text, language.value)
  item.region.lines.splice(item.index + 1, 0, ...added)
  bump({ line: added[added.length - 1], offset: rest[rest.length - 1].length })
}

function collect() {
  const list = regions.value.map((region) => edits[regionKey(region)]).filter(Boolean)
  const base = baseLines.value
  const out = []
  let cursor = 0
  for (const entry of list) {
    out.push(...base.slice(cursor, entry.start - 1))
    out.push(...entry.lines.map((line) => line.text))
    cursor = entry.end
  }
  out.push(...base.slice(cursor))
  return out.join('\n')
}

function resetEdits() {
  activeId.value = 0
  for (const key of Object.keys(edits)) delete edits[key]
  renderTick.value += 1
  if (dirty.value) {
    dirty.value = false
    emit('dirty', false)
  }
}

watch(
  () => [props.text, props.baseText, props.editable],
  () => {
    activeId.value = 0
    for (const key of Object.keys(edits)) delete edits[key]
    renderTick.value += 1
    if (dirty.value) {
      dirty.value = false
      emit('dirty', false)
    }
  },
)

defineExpose({ collect, resetEdits })
</script>

<style scoped>
.diff {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}
.head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}
.headline {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.title {
  flex: 0 1 auto;
  min-width: 0;
  font-size: 0.82rem;
  color: rgb(var(--v-theme-on-surface-variant));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.headline :deep(.v-chip) {
  flex: 0 0 auto;
}
.readonly {
  flex: 0 1 auto;
  min-width: 0;
  font-size: 0.74rem;
  color: rgb(var(--v-theme-on-surface-variant));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hint {
  margin: 16px;
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.9rem;
}
.hint.bad {
  color: rgb(var(--v-theme-error));
}
.body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  font-size: 0.78rem;
  line-height: 1.55;
  padding-bottom: 24px;
}
.row {
  display: flex;
  align-items: flex-start;
  white-space: pre;
  min-height: 1.55em;
}
.row.add {
  background: rgba(46, 160, 67, 0.14);
}
.row.del {
  background: rgba(248, 81, 73, 0.14);
}
.row.hunk {
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.06);
  padding: 2px 12px;
}
.row.meta {
  color: rgb(var(--v-theme-on-surface-variant));
  padding: 1px 12px;
}
.ln {
  flex: 0 0 44px;
  text-align: right;
  padding-right: 8px;
  color: rgb(var(--v-theme-on-surface-variant));
  user-select: none;
  border-right: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
.sign {
  flex: 0 0 16px;
  text-align: center;
  user-select: none;
}
.row.add .sign {
  color: rgb(var(--v-theme-added));
}
.row.del .sign {
  color: rgb(var(--v-theme-deleted));
}
.text {
  flex: 1 1 auto;
  padding-right: 16px;
}
.edit-idle {
  cursor: text;
}
.text.edit {
  outline: none;
  white-space: pre;
  caret-color: rgb(var(--v-theme-primary));
}
.text.edit:focus {
  background: rgba(var(--v-theme-primary), 0.1);
}
/* 差异里的代码按浏览目录同一套颜色着色。 */
.text :deep(.hljs-comment),
.text :deep(.hljs-quote) {
  color: rgb(var(--v-theme-on-surface-variant));
  font-style: italic;
}
.text :deep(.hljs-keyword),
.text :deep(.hljs-selector-tag),
.text :deep(.hljs-built_in),
.text :deep(.hljs-type) {
  color: rgb(var(--v-theme-primary));
}
.text :deep(.hljs-string),
.text :deep(.hljs-regexp),
.text :deep(.hljs-addition) {
  color: rgb(var(--v-theme-added));
}
.text :deep(.hljs-number),
.text :deep(.hljs-literal),
.text :deep(.hljs-attr),
.text :deep(.hljs-attribute),
.text :deep(.hljs-property) {
  color: rgb(var(--v-theme-modified));
}
.text :deep(.hljs-title),
.text :deep(.hljs-section),
.text :deep(.hljs-name) {
  color: rgb(var(--v-theme-primary));
}
.text :deep(.hljs-tag),
.text :deep(.hljs-meta) {
  color: rgb(var(--v-theme-on-surface-variant));
}
.text :deep(.hljs-deletion) {
  color: rgb(var(--v-theme-deleted));
}
.wide {
  padding: 0 4px;
}
</style>
