<template>
  <div class="panel" @keydown.ctrl.s.prevent="save">
    <div class="bar">
      <div class="left">
        <v-text-field
          v-model="query"
          density="compact"
          variant="outlined"
          hide-details
          clearable
          placeholder="搜索文件名或文件内容"
          prepend-inner-icon="mdi-magnify"
          class="search"
          @keyup.enter="runSearch"
          @keydown.esc="clearSearch"
        />
        <v-btn-toggle
          v-model="mode"
          density="compact"
          variant="text"
          divided
          mandatory
          class="modes"
        >
          <v-btn value="name" size="small" title="按工作副本内的相对路径匹配">文件名</v-btn>
          <v-btn value="content" size="small">内容</v-btn>
        </v-btn-toggle>
      </div>
      <v-btn
        v-if="searching"
        size="small"
        variant="text"
        prepend-icon="mdi-arrow-left"
        title="退出搜索，回到目录树"
        @click="clearSearch"
      >
        返回目录
      </v-btn>
      <v-btn
        size="small"
        variant="text"
        color="primary"
        prepend-icon="mdi-refresh"
        :loading="refreshing"
        @click="refresh"
      >
        刷新
      </v-btn>
    </div>

    <div ref="splitRef" class="body" :class="{ resizing }">
      <aside class="tree" :style="{ '--tree-width': `${treeWidth}px` }">
        <template v-if="searching">
          <div class="result-head">
            <span v-if="search.loading">正在搜索…</span>
            <span v-else-if="search.error" class="bad">{{ search.error }}</span>
            <span v-else>
              {{ search.matches.length }} 条结果
              <template v-if="search.truncated">，只列了前面一部分</template>
            </span>
          </div>
          <p v-if="!search.loading && !search.error && !search.matches.length" class="hint">
            没有找到匹配的文件。
          </p>
          <div
            v-for="(hit, i) in search.matches"
            :key="i"
            class="hit"
            :class="{
              active: activePath === hit.path,
              content: search.mode === 'content',
            }"
            :title="hit.path"
            @click="openHit(hit)"
          >
            <template v-if="search.mode === 'content'">
              <div class="hit-path mono">
                {{ hit.path }}<span class="hit-line">:{{ hit.line }}</span>
              </div>
              <div class="hit-text mono">{{ hit.text }}</div>
            </template>
            <template v-else>
              <v-icon
                size="16"
                class="ficon"
                :style="iconOf(hit).color ? { color: iconOf(hit).color } : null"
              >
                {{ iconOf(hit).icon }}
              </v-icon>
              <div class="hit-name">
                <div class="name mono">{{ hit.name }}</div>
                <div class="dir mono">{{ dirOf(hit.path) }}</div>
              </div>
            </template>
          </div>
        </template>
        <FileTree
          v-show="!searching"
          :key="ws.id"
          ref="treeRef"
          :loader="loadLayer"
          :root="rootNode"
          :row-class="rowClass"
          pick-on-row-click
          :texts="treeTexts"
          @pick="pick"
        />
      </aside>

      <SplitHandle axis="x" :active="resizing" @start="startSplit" @reset="resetSplit" />

      <section class="viewer">
        <div v-if="activeNode" class="file-head">
          <nav class="crumbs">
            <button class="seg" title="回到根目录" @click="reveal('')">{{ rootName }}</button>
            <template v-for="(seg, i) in crumbs" :key="seg.path">
              <span class="sep">/</span>
              <button
                class="seg"
                :class="{ last: i === crumbs.length - 1 }"
                :title="seg.path"
                @click="crumb(seg, i)"
              >
                {{ seg.name }}
              </button>
            </template>
          </nav>
          <span class="meta">{{ sizeText }}</span>
        </div>

        <p v-if="file.loading" class="hint">正在读取文件…</p>
        <p v-else-if="file.error" class="hint bad">{{ file.error }}</p>
        <div v-else-if="activeNode" class="edit-wrap">
          <p v-if="edit.error" class="hint bad edit-error">{{ edit.error }}</p>
          <div class="edit-body">
            <div ref="gutterRef" class="gutter" aria-hidden="true">
              <div v-for="n in lineCount" :key="n" class="ln">{{ n }}</div>
            </div>
            <div class="edit-stage">
              <pre class="layer-code" aria-hidden="true"><code ref="codeRef" v-html="highlighted"></code></pre>
              <textarea
                ref="editorRef"
                v-model="edit.draft"
                class="editor"
                wrap="off"
                spellcheck="false"
                @scroll="onEditorScroll"
                @keydown.tab.prevent="insertTab"
              />
            </div>
          </div>
        </div>
        <div v-else class="none">从左边选一个文件，右边显示它的内容。</div>
      </section>
    </div>

    <v-dialog
      :model-value="leaveAsk"
      max-width="440"
      @update:model-value="(open) => !open && answerLeave(false)"
    >
      <v-card>
        <v-card-title>文件还没保存</v-card-title>
        <v-card-text>
          {{ activePath || '当前文件' }}
          <p class="tip">换过去之后这次的修改就没了，要保留就先按 Ctrl+S 保存。</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="answerLeave(false)">留在这里</v-btn>
          <v-btn color="error" variant="flat" @click="answerLeave(true)">丢掉修改</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import SplitHandle from './SplitHandle.vue'
import { api } from '../composables/useApi'
import { FileTree, fileIcon } from '@bash-scripts/web-shared'
import { dirName } from '../composables/format'
import { highlightCode, languageOf } from '@bash-scripts/web-shared/highlight'
import { usePreferencesStore } from '../stores/preferences'
import { useSplitPane } from '@bash-scripts/web-shared'

const props = defineProps({
  ws: { type: Object, required: true },
})

const treeRef = ref(null)
const activeNode = ref(null)
const file = reactive({ text: '', loading: false, error: '' })
const refreshing = ref(false)
let seq = 0
// 左侧目录树的宽度随分隔条拖动改变，双击分隔条还原。
const splitRef = ref(null)
const { size: treeWidth, resizing, start: startSplit, reset: resetSplit } = useSplitPane({
  area: splitRef,
  initial: 300,
  min: 180,
  rightMin: 320,
  persist: 'dvcsx.browse.tree-width',
})
// 搜索：query 非空时左侧换成结果列表，模式在文件名与内容之间切换。
const preferences = usePreferencesStore()
const { searchMode: mode } = storeToRefs(preferences)
const query = ref('')
const searching = computed(() => query.value.trim() !== '')
const search = reactive({ loading: false, error: '', matches: [], truncated: false, mode: 'name' })
let searchSeq = 0
let searchTimer = 0
const gutterRef = ref(null)
const codeRef = ref(null)
// 文件一打开就能直接改：草稿与磁盘上的内容分开，行尾统一成 \n 再比较。
const editorRef = ref(null)
const edit = reactive({ base: '', draft: '', saving: false, error: '' })

const rootName = computed(
  () => String(props.ws.root || '').replace(/\/+$/, '').split('/').pop() || '/',
)
const rootNode = computed(() => ({ name: rootName.value, path: '', type: 'dir' }))
const activePath = computed(() => (activeNode.value ? activeNode.value.path : ''))
const crumbs = computed(() => {
  const parts = activePath.value.split('/').filter(Boolean)
  let acc = ''
  return parts.map((name) => {
    acc = acc ? `${acc}/${name}` : name
    return { name, path: acc }
  })
})
const language = computed(() => languageOf(activePath.value))
// 末尾的换行只对应编辑框里多出来的空行，行号按编辑框的实际行数走。
const draftText = computed(() =>
  edit.draft.endsWith('\n') ? edit.draft.slice(0, -1) : edit.draft,
)
const lineCount = computed(() => edit.draft.split('\n').length)
const highlighted = computed(() => highlightCode(draftText.value, language.value))
const dirty = computed(() => edit.draft !== edit.base)
const sizeText = computed(() => {
  if (!activeNode.value || activeNode.value.size === undefined) return ''
  const bytes = Number(activeNode.value.size) || 0
  if (bytes < 1024) return `${bytes} 字节`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
})

// 取数函数与行内状态由这一侧给，树的展开与缓存交给共用组件。
const loadLayer = (path) => api.tree(props.ws.id, path)
const rowClass = (node) => ({ selected: node.type === 'file' && node.path === activePath.value })
const treeTexts = { truncated: '这一层文件太多，只列了前面一部分。' }

async function reveal(dirPath) {
  await treeRef.value?.reveal(dirPath)
}

async function pick(node) {
  if (!(await leaveFile())) return
  activeNode.value = node
  openFile()
}

async function openHit(hit) {
  if (!(await leaveFile())) return
  activeNode.value = { name: hit.name, path: hit.path, type: 'file' }
  openFile(hit.line || 0)
}

// 换文件前统一问一句，没改过就直接走。
let leaveResolve = null
const leaveAsk = ref(false)

function leaveFile() {
  if (!dirty.value) return Promise.resolve(true)
  if (leaveAsk.value) return Promise.resolve(false)
  leaveAsk.value = true
  return new Promise((resolve) => {
    leaveResolve = resolve
  })
}

function answerLeave(drop) {
  leaveAsk.value = false
  if (!leaveResolve) return
  const resolve = leaveResolve
  leaveResolve = null
  resolve(drop)
}

async function save() {
  if (edit.saving || !dirty.value) return
  edit.saving = true
  edit.error = ''
  const path = activePath.value
  try {
    const data = await api.save(props.ws.id, path, edit.draft)
    // 保存期间可能已经换到别的文件，那边的内容不能被这份草稿盖掉。
    if (activePath.value === path) {
      edit.base = edit.draft
      file.text = edit.draft
      if (activeNode.value) activeNode.value = { ...activeNode.value, size: data.size }
    }
    // 目录树里记着文件大小，保存后把这一层重新列一遍。
    treeRef.value?.reloadDir(dirName(path))
  } catch (err) {
    edit.error = err.message
  } finally {
    edit.saving = false
  }
}

// 编辑器里 Tab 插入四个空格，而不是把焦点移走。
function insertTab(event) {
  const el = event.target
  const start = el.selectionStart
  const end = el.selectionEnd
  edit.draft = `${edit.draft.slice(0, start)}    ${edit.draft.slice(end)}`
  nextTick(() => {
    el.selectionStart = start + 4
    el.selectionEnd = start + 4
  })
}

// 高亮层与行号列跟着编辑框一起滚，三层始终对在同一位置。
function syncEditorScroll(el) {
  if (codeRef.value) {
    codeRef.value.style.transform = `translate(${-el.scrollLeft}px, ${-el.scrollTop}px)`
  }
  if (gutterRef.value) gutterRef.value.scrollTop = el.scrollTop
}

function onEditorScroll(event) {
  syncEditorScroll(event.target)
}

// 内容命中的行选中，并滚到可视区上三分之一处。
async function locateLine(line) {
  await nextTick()
  const el = editorRef.value
  if (!el) return
  const lines = edit.draft.split('\n')
  const index = Math.min(Math.max(Number(line) || 1, 1), lines.length)
  let start = 0
  for (let i = 0; i < index - 1; i += 1) start += lines[i].length + 1
  el.focus()
  el.setSelectionRange(start, start + lines[index - 1].length)
  const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20
  el.scrollTop = Math.max(0, (index - 1) * lineHeight - el.clientHeight / 3)
  syncEditorScroll(el)
}

async function openFile(line = 0) {
  if (!activeNode.value) return
  const mine = ++seq
  file.loading = true
  file.error = ''
  edit.error = ''
  try {
    const data = await api.file(props.ws.id, activeNode.value.path)
    if (mine !== seq) return
    file.text = data.text || ''
    edit.base = file.text.replace(/\r\n?/g, '\n')
    edit.draft = edit.base
  } catch (err) {
    if (mine !== seq) return
    file.text = ''
    edit.base = ''
    edit.draft = ''
    file.error = err.message
  } finally {
    if (mine === seq) file.loading = false
  }
  if (mine !== seq) return
  await nextTick()
  const el = editorRef.value
  if (!el) return
  el.scrollTop = 0
  el.scrollLeft = 0
  syncEditorScroll(el)
  // 等编辑框真的渲染出来再定位，加载中的占位元素上没有它。
  if (line) await locateLine(line)
}

// 退出搜索：清空输入，结果列表跟着收起来，左侧回到目录树。
function clearSearch() {
  query.value = ''
  search.matches = []
  search.error = ''
  search.loading = false
  search.truncated = false
}

function iconOf(hit) {
  return fileIcon(hit.name)
}

function dirOf(path) {
  return dirName(path)
}

async function runSearch() {
  clearTimeout(searchTimer)
  const text = query.value.trim()
  if (!text) return
  const mine = ++searchSeq
  search.loading = true
  search.error = ''
  try {
    const data = await api.search(props.ws.id, text, mode.value)
    if (mine !== searchSeq) return
    search.matches = data.matches || []
    search.truncated = !!data.truncated
  } catch (err) {
    if (mine !== searchSeq) return
    search.matches = []
    search.truncated = false
    search.error = err.message
  } finally {
    if (mine === searchSeq) search.loading = false
  }
}

// 输入停下来再搜，免得每敲一个字都扫一遍工作副本；条件一变就让旧结果作废。
watch([query, mode], () => {
  clearTimeout(searchTimer)
  searchSeq += 1
  search.matches = []
  search.truncated = false
  search.error = ''
  search.mode = mode.value
  if (!searching.value) {
    search.loading = false
    return
  }
  search.loading = true
  searchTimer = setTimeout(runSearch, 300)
})

function crumb(seg, index) {
  if (index === crumbs.value.length - 1) return
  reveal(seg.path)
}

async function refresh() {
  refreshing.value = true
  try {
    if (searching.value) {
      await runSearch()
      return
    }
    await treeRef.value?.refreshAll()
    // 有没保存的改动就不重新读，免得草稿被磁盘上的旧内容盖掉。
    if (activeNode.value && !dirty.value) await openFile()
  } finally {
    refreshing.value = false
  }
}

function reset() {
  answerLeave(false)
  // 树按 ws.id 重建一份，展开状态与缓存不在这里清。
  activeNode.value = null
  file.text = ''
  file.error = ''
  file.loading = false
  edit.base = ''
  edit.draft = ''
  edit.saving = false
  edit.error = ''
  query.value = ''
  search.matches = []
  search.error = ''
  search.loading = false
  search.truncated = false
}

watch(() => props.ws.id, reset)
onMounted(reset)
onBeforeUnmount(() => {
  clearTimeout(searchTimer)
  searchSeq += 1
  answerLeave(false)
})
</script>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}
.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 12px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}
.left {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}
.search {
  flex: 0 1 460px;
  min-width: 180px;
}
.modes {
  flex: 0 0 auto;
}
.result-head {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 6px 10px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  background: rgb(var(--v-theme-surface));
  font-size: 0.74rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.result-head .bad {
  color: rgb(var(--v-theme-error));
}
.hit {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 10px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.07);
  cursor: pointer;
}
.hit:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
}
.hit.active {
  background: rgba(var(--v-theme-primary), 0.14);
}
.hit.content {
  display: block;
}
.ficon {
  flex: 0 0 auto;
  margin-top: 1px;
}
.hit-name {
  flex: 1 1 auto;
  min-width: 0;
}
.hit-name .name,
.hit-name .dir {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hit-name .name {
  font-size: 0.78rem;
}
.hit-name .dir {
  font-size: 0.7rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.hit-path {
  font-size: 0.74rem;
  color: rgb(var(--v-theme-primary));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hit-line {
  color: rgb(var(--v-theme-on-surface-variant));
}
.hit-text {
  margin-top: 1px;
  font-size: 0.76rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.body {
  flex: 1 1 auto;
  display: flex;
  min-height: 0;
}
.body.resizing {
  cursor: col-resize;
  user-select: none;
}
.tree {
  width: var(--tree-width, 300px);
  flex: 0 0 var(--tree-width, 300px);
  overflow: auto;
  padding: 6px 4px;
}
.viewer {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.file-head {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 34px;
  padding: 0 12px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}
.crumbs {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
}
.seg {
  flex: 0 1 auto;
  min-width: 0;
  padding: 0 2px;
  border: none;
  background: none;
  font: inherit;
  font-size: 0.78rem;
  color: rgb(var(--v-theme-primary));
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
}
.seg:hover {
  text-decoration: underline;
}
.seg.last {
  color: rgb(var(--v-theme-on-surface));
  cursor: default;
}
.seg.last:hover {
  text-decoration: none;
}
.sep {
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.78rem;
}
.meta {
  flex: 0 0 auto;
  font-size: 0.72rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.edit-wrap {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.edit-error {
  margin: 8px 12px 0;
}
.edit-body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
}
/* 行号列与高亮层都不接鼠标，输入落在外层透明的编辑框上。 */
.gutter {
  z-index: 2;
  flex: 0 0 auto;
  overflow: hidden;
  padding: 10px 8px 48px 12px;
  text-align: right;
  font-size: 0.78rem;
  line-height: 1.6;
  color: rgb(var(--v-theme-on-surface-variant));
  user-select: none;
  background: rgb(var(--v-theme-surface));
  border-right: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
.ln {
  height: 1.6em;
}
.edit-stage {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
}
.layer-code {
  position: absolute;
  inset: 0;
  z-index: 0;
  margin: 0;
  padding: 10px 16px 24px 12px;
  overflow: hidden;
  font-size: 0.78rem;
  line-height: 1.6;
  white-space: pre;
  tab-size: 4;
  pointer-events: none;
}
.layer-code code {
  display: block;
  will-change: transform;
}
/* 编辑框的文字是透明的，颜色由底下这层高亮给；行尾不折行，Tab 由脚本插空格。 */
.editor {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 10px 16px 24px 12px;
  border: none;
  outline: none;
  resize: none;
  font-family: 'JetBrains Mono', 'Noto Sans Mono CJK SC', 'Sarasa Mono SC',
    'Cascadia Mono', Consolas, Menlo, 'Liberation Mono', monospace;
  font-size: 0.78rem;
  line-height: 1.6;
  tab-size: 4;
  white-space: pre;
  overflow: auto;
  background: transparent;
  color: transparent;
  caret-color: rgb(var(--v-theme-on-surface));
}
.editor::selection {
  background: rgba(var(--v-theme-primary), 0.28);
}
/* 高亮层要跟编辑框逐字对齐，斜体会让字宽对不上，注释一律正体。 */
.layer-code :deep(.hljs-comment),
.layer-code :deep(.hljs-quote) {
  color: rgb(var(--v-theme-on-surface-variant));
  font-style: normal;
}
.layer-code :deep(.hljs-keyword),
.layer-code :deep(.hljs-selector-tag),
.layer-code :deep(.hljs-built_in),
.layer-code :deep(.hljs-type) {
  color: rgb(var(--v-theme-primary));
}
.layer-code :deep(.hljs-string),
.layer-code :deep(.hljs-regexp),
.layer-code :deep(.hljs-addition) {
  color: rgb(var(--v-theme-added));
}
.layer-code :deep(.hljs-number),
.layer-code :deep(.hljs-literal),
.layer-code :deep(.hljs-attr),
.layer-code :deep(.hljs-attribute),
.layer-code :deep(.hljs-property) {
  color: rgb(var(--v-theme-modified));
}
.layer-code :deep(.hljs-title),
.layer-code :deep(.hljs-section),
.layer-code :deep(.hljs-name) {
  color: rgb(var(--v-theme-primary));
}
.layer-code :deep(.hljs-tag),
.layer-code :deep(.hljs-meta) {
  color: rgb(var(--v-theme-on-surface-variant));
}
.layer-code :deep(.hljs-deletion) {
  color: rgb(var(--v-theme-deleted));
}
.tip {
  margin-top: 8px;
  font-size: 0.78rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.hint {
  margin: 16px;
  font-size: 0.84rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.hint.bad {
  color: rgb(var(--v-theme-error));
}
.none {
  padding: 16px;
  font-size: 0.84rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
@media (max-width: 900px) {
  .body {
    flex-direction: column;
  }
  .tree {
    width: 100%;
    flex: 0 0 auto;
    max-height: 220px;
    border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  }
  .vgutter {
    display: none;
  }
}
</style>
