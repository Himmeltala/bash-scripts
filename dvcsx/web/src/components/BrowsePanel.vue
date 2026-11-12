<template>
  <div class="panel">
    <div class="bar">
      <span class="count">直接读工作副本里的文件，点文件名看内容</span>
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

    <div class="body">
      <aside class="tree">
        <BrowseTree
          :node="rootNode"
          :depth="0"
          :expanded="expanded"
          :cache="cache"
          :selected="activePath"
          @toggle="toggle"
          @pick="pick"
        />
      </aside>

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
          <div v-else class="code-wrap">
            <div class="gutter" aria-hidden="true">
              <div v-for="n in lineCount" :key="n" class="ln">{{ n }}</div>
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
import { computed, onMounted, reactive, ref, watch } from 'vue'
import BrowseTree from './BrowseTree.vue'
import { api } from '../composables/useApi'
import { highlightCode, languageOf } from '../composables/highlight'

const props = defineProps({
  ws: { type: Object, required: true },
})

const cache = reactive({})
const expanded = reactive({})
const activeNode = ref(null)
const file = reactive({ text: '', loading: false, error: '' })
const refreshing = ref(false)
let seq = 0

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
  if (!activeNode.value) return ''
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
  activeNode.value = node
  openFile()
}

async function openFile() {
  if (!activeNode.value) return
  const mine = ++seq
  file.loading = true
  file.error = ''
  try {
    const data = await api.file(props.ws.id, activeNode.value.path)
    if (mine !== seq) return
    file.text = data.text || ''
  } catch (err) {
    if (mine !== seq) return
    file.text = ''
    file.error = err.message
  } finally {
    if (mine === seq) file.loading = false
  }
}

function crumb(seg, index) {
  if (index === crumbs.value.length - 1) return
  reveal(seg.path)
}

async function refresh() {
  refreshing.value = true
  try {
    await Promise.all(Object.keys(cache).map((path) => loadDir(path, true)))
    if (activeNode.value) await openFile()
  } finally {
    refreshing.value = false
  }
}

function reset() {
  for (const key of Object.keys(cache)) delete cache[key]
  for (const key of Object.keys(expanded)) delete expanded[key]
  expanded[''] = true
  activeNode.value = null
  file.text = ''
  file.error = ''
  file.loading = false
  loadDir('')
}

watch(() => props.ws.id, reset)
onMounted(reset)
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
.count {
  font-size: 0.76rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.body {
  flex: 1 1 auto;
  display: flex;
  min-height: 0;
}
.tree {
  width: 300px;
  flex: 0 0 300px;
  overflow: auto;
  padding: 6px 4px;
  border-right: 1px solid rgba(var(--v-theme-on-surface), 0.12);
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
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  align-items: flex-start;
  overflow: auto;
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
.code {
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
    border-right: none;
    border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  }
}
</style>
