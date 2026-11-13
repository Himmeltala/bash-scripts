<template>
  <div class="panel">
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
        <BrowseTree
          v-else
          :node="rootNode"
          :depth="0"
          :expanded="expanded"
          :cache="cache"
          :selected="activePath"
          @toggle="toggle"
          @pick="pick"
        />
      </aside>

      <div
        class="vgutter"
        title="拖动调整两侧宽度，双击还原"
        @pointerdown="startSplit"
        @dblclick="resetSplit"
      >
        <span class="grip" />
      </div>

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
        <template v-else-if="activeNode">
          <p v-if="!displayText" class="hint">文件是空的。</p>
          <div v-else ref="codeWrapRef" class="code-wrap">
            <div v-if="hitBand" class="hitband" :style="hitBand" />
            <div ref="gutterRef" class="gutter" aria-hidden="true">
              <div v-for="n in lineCount" :key="n" class="ln" :class="{ hitline: n === hitLine }">
                {{ n }}
              </div>
            </div>
            <pre class="code"><code v-html="highlighted"></code></pre>
          </div>
        </template>
        <div v-else class="none">从左边选一个文件，右边显示它的内容。</div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import BrowseTree from './BrowseTree.vue'
import { api } from '../composables/useApi'
import { fileIcon } from '../composables/fileIcons'
import { dirName } from '../composables/format'
import { highlightCode, languageOf } from '../composables/highlight'
import { usePreferencesStore } from '../stores/preferences'

const props = defineProps({
  ws: { type: Object, required: true },
})

const cache = reactive({})
const expanded = reactive({})
const activeNode = ref(null)
const file = reactive({ text: '', loading: false, error: '' })
const refreshing = ref(false)
let seq = 0
// 左侧目录树的宽度随分隔条拖动改变，双击分隔条还原。
const splitRef = ref(null)
const treeWidth = ref(300)
const resizing = ref(false)
let startX = 0
let startWidth = 0
// 搜索：query 非空时左侧换成结果列表，模式在文件名与内容之间切换。
const preferences = usePreferencesStore()
const { searchMode: mode } = storeToRefs(preferences)
const query = ref('')
const searching = computed(() => query.value.trim() !== '')
const search = reactive({ loading: false, error: '', matches: [], truncated: false, mode: 'name' })
let searchSeq = 0
let searchTimer = 0
// 内容命中的行号，打开文件后滚到那一行并把行号标出来。
const hitLine = ref(0)
const hitBand = ref(null)
const codeWrapRef = ref(null)
const gutterRef = ref(null)

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
// 末尾的换行不占一行，去掉之后行号与内容才对得上。
const displayText = computed(() => {
  const text = file.text || ''
  return text.endsWith('\n') ? text.slice(0, -1) : text
})
const lineCount = computed(() => (displayText.value ? displayText.value.split('\n').length : 0))
const highlighted = computed(() => highlightCode(displayText.value, language.value))
const sizeText = computed(() => {
  if (!activeNode.value || activeNode.value.size === undefined) return ''
  const bytes = Number(activeNode.value.size) || 0
  if (bytes < 1024) return `${bytes} 字节`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
})

async function loadDir(path, force = false) {
  if (!force && cache[path]) return
  if (!cache[path]) cache[path] = { loading: false, error: '', entries: [], truncated: false }
  const state = cache[path]
  state.loading = true
  state.error = ''
  try {
    const data = await api.tree(props.ws.id, path)
    state.entries = data.entries || []
    state.truncated = data.truncated || false
  } catch (err) {
    state.error = err.message
    state.entries = []
  } finally {
    state.loading = false
  }
}

function toggle(path) {
  expanded[path] = !expanded[path]
  if (expanded[path]) loadDir(path)
}

async function reveal(dirPath) {
  expanded[''] = true
  await loadDir('')
  let acc = ''
  for (const seg of String(dirPath || '').split('/').filter(Boolean)) {
    acc = acc ? `${acc}/${seg}` : seg
    await loadDir(acc)
    expanded[acc] = true
  }
}

function pick(node) {
  hitLine.value = 0
  hitBand.value = null
  activeNode.value = node
  openFile()
}

function openHit(hit) {
  activeNode.value = { name: hit.name, path: hit.path, type: 'file' }
  openFile(hit.line || 0)
}

// 内容命中的行滚到可视区上三分之一处，行号标出来，整行再垫一层底色。
async function scrollToLine(line) {
  await nextTick()
  const wrap = codeWrapRef.value
  const gutter = gutterRef.value
  const cell = gutter ? gutter.children[line - 1] : null
  if (!wrap || !gutter || !cell) return
  const box = wrap.getBoundingClientRect()
  const row = cell.getBoundingClientRect()
  // 先按内容坐标记下这一行的位置，再滚，行高与行号列一致。
  hitBand.value = {
    top: `${row.top - box.top + wrap.scrollTop}px`,
    left: `${gutter.offsetWidth}px`,
    height: `${row.height}px`,
    right: '0',
  }
  wrap.scrollTop += row.top - box.top - wrap.clientHeight / 3
}

async function openFile(line = 0) {
  if (!activeNode.value) return
  const mine = ++seq
  file.loading = true
  file.error = ''
  hitBand.value = null
  try {
    const data = await api.file(props.ws.id, activeNode.value.path)
    if (mine !== seq) return
    file.text = data.text || ''
    hitLine.value = line
  } catch (err) {
    if (mine !== seq) return
    file.text = ''
    file.error = err.message
    hitLine.value = 0
  } finally {
    if (mine === seq) file.loading = false
  }
  // 等代码区真的渲染出来再量位置，加载中的占位元素上没有行号。
  if (line && mine === seq) await scrollToLine(line)
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
    await Promise.all(Object.keys(cache).map((path) => loadDir(path, true)))
    if (activeNode.value) await openFile(hitLine.value)
  } finally {
    refreshing.value = false
  }
}

function reset() {
  for (const key of Object.keys(cache)) delete cache[key]
  for (const key of Object.keys(expanded)) delete expanded[key]
  expanded[''] = true
  activeNode.value = null
  hitLine.value = 0
  hitBand.value = null
  file.text = ''
  file.error = ''
  file.loading = false
  query.value = ''
  search.matches = []
  search.error = ''
  search.loading = false
  search.truncated = false
  loadDir('')
}

function startSplit(event) {
  if (event.button !== 0 || !splitRef.value) return
  resizing.value = true
  startX = event.clientX
  startWidth = treeWidth.value
  event.preventDefault()
  window.addEventListener('pointermove', onSplitMove)
  window.addEventListener('pointerup', endSplit, { once: true })
}

function onSplitMove(event) {
  const total = splitRef.value ? splitRef.value.clientWidth : 0
  if (!total) return
  // 右侧至少留 320 像素看文件内容，左侧不窄于 180 像素。
  const max = Math.max(180, total - 320)
  treeWidth.value = Math.min(Math.max(startWidth + event.clientX - startX, 180), max)
}

function endSplit() {
  resizing.value = false
  window.removeEventListener('pointermove', onSplitMove)
}

function resetSplit() {
  treeWidth.value = 300
}

watch(() => props.ws.id, reset)
onMounted(reset)
onBeforeUnmount(() => {
  clearTimeout(searchTimer)
  searchSeq += 1
  endSplit()
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
.vgutter {
  flex: 0 0 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: col-resize;
  background: rgba(var(--v-theme-on-surface), 0.04);
  border-left: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-right: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
.vgutter .grip {
  width: 3px;
  height: 36px;
  border-radius: 2px;
  background: rgba(var(--v-theme-on-surface), 0.22);
}
.vgutter:hover,
.body.resizing .vgutter {
  background: rgba(var(--v-theme-primary), 0.12);
}
.vgutter:hover .grip,
.body.resizing .vgutter .grip {
  background: rgb(var(--v-theme-primary));
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
.code-wrap {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  align-items: flex-start;
  overflow: auto;
}
.hitband {
  position: absolute;
  z-index: 0;
  border-radius: 3px;
  background: rgba(var(--v-theme-primary), 0.12);
  pointer-events: none;
}
.gutter {
  position: sticky;
  left: 0;
  z-index: 1;
  flex: 0 0 auto;
  padding: 10px 8px 24px 12px;
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
.ln.hitline {
  color: rgb(var(--v-theme-primary));
  font-weight: 700;
}
.code {
  position: relative;
  z-index: 1;
  flex: 1 1 auto;
  margin: 0;
  padding: 10px 16px 24px 12px;
  font-size: 0.78rem;
  line-height: 1.6;
  white-space: pre;
  tab-size: 4;
}
.code-wrap :deep(.hljs-comment),
.code-wrap :deep(.hljs-quote) {
  color: rgb(var(--v-theme-on-surface-variant));
  font-style: italic;
}
.code-wrap :deep(.hljs-keyword),
.code-wrap :deep(.hljs-selector-tag),
.code-wrap :deep(.hljs-built_in),
.code-wrap :deep(.hljs-type) {
  color: rgb(var(--v-theme-primary));
}
.code-wrap :deep(.hljs-string),
.code-wrap :deep(.hljs-regexp),
.code-wrap :deep(.hljs-addition) {
  color: rgb(var(--v-theme-added));
}
.code-wrap :deep(.hljs-number),
.code-wrap :deep(.hljs-literal),
.code-wrap :deep(.hljs-attr),
.code-wrap :deep(.hljs-attribute),
.code-wrap :deep(.hljs-property) {
  color: rgb(var(--v-theme-modified));
}
.code-wrap :deep(.hljs-title),
.code-wrap :deep(.hljs-section),
.code-wrap :deep(.hljs-name) {
  color: rgb(var(--v-theme-primary));
}
.code-wrap :deep(.hljs-tag),
.code-wrap :deep(.hljs-meta) {
  color: rgb(var(--v-theme-on-surface-variant));
}
.code-wrap :deep(.hljs-deletion) {
  color: rgb(var(--v-theme-deleted));
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
