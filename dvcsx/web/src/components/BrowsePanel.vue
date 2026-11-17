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
          :root-path="ws.root"
          :download-of="downloadOf"
          :row-class="rowClass"
          pick-on-row-click
          :texts="treeTexts"
          editable
          @pick="pick"
          @action="onTreeAction"
        />
      </aside>

      <SplitHandle axis="x" :active="resizing" @start="startSplit" @reset="resetSplit" />

      <div v-if="held" class="deferred">
        <v-icon size="28" class="deferred-icon">mdi-file-hidden</v-icon>
        <div class="deferred-path mono" :title="held.path">{{ held.path }}</div>
        <p class="deferred-hint">
          这个文件有 {{ formatBytes(held.size) }}，超过 {{ formatBytes(PREVIEW_MAX) }} 的预览上限，默认不加载。
        </p>
        <v-btn color="primary" variant="flat" size="small" @click="downloadHeld">下载文件</v-btn>
      </div>
      <FileEditor
        v-else
        ref="editorRef"
        :root-name="rootName"
        :size="activeNode ? activeNode.size : undefined"
        :loader="loadFile"
        :saver="saveFile"
        @navigate="reveal"
        @saved="onSaved"
      />
    </div>

    <FloatingDialog
      v-model="nameAsk.on"
      :initial-width="420"
      :initial-height="280"
      :min-width="340"
      :min-height="220"
      persistent
    >
      <template #title>{{ nameTitle }}</template>
      <v-text-field
        v-model="nameAsk.value"
        density="compact"
        variant="outlined"
        autofocus
        hide-details
        :label="nameLabel"
        :error-messages="nameAsk.error ? [nameAsk.error] : []"
        @keyup.enter="submitName"
      />
      <template #actions>
        <v-btn variant="text" @click="nameAsk.on = false">取消</v-btn>
        <v-spacer />
        <v-btn color="primary" variant="flat" :loading="nameAsk.busy" @click="submitName">
          确定
        </v-btn>
      </template>
    </FloatingDialog>

    <FloatingDialog
      v-model="delAsk.on"
      :initial-width="460"
      :initial-height="280"
      :min-width="360"
      :min-height="220"
      persistent
    >
      <template #title>删除{{ delAsk.node && delAsk.node.type === 'dir' ? '目录' : '文件' }}</template>
      <p class="ask-path mono">{{ delAsk.node ? delAsk.node.path : '' }}</p>
      <p class="ask-hint">
        目录会连同里面的文件一起删除。已纳入版本控制的能从版本库里找回，未纳管的删了就没了。
      </p>
      <p v-if="delAsk.error" class="ask-error">{{ delAsk.error }}</p>
      <template #actions>
        <v-btn variant="text" @click="delAsk.on = false">取消</v-btn>
        <v-spacer />
        <v-btn color="error" variant="flat" :loading="delAsk.busy" @click="submitDelete">
          删除
        </v-btn>
      </template>
    </FloatingDialog>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { api } from '../composables/useApi'
import {
  FileEditor,
  FileTree,
  FloatingDialog,
  SplitHandle,
  fileIcon,
} from '@bash-scripts/web-shared'
import { formatBytes } from '@bash-scripts/web-shared/format'
import { PREVIEW_MAX, entryNameProblem, isHeldNode } from '../composables/browseOps'
import { dirName } from '../composables/format'
import { usePreferencesStore } from '../stores/preferences'
import { useSplitPane } from '@bash-scripts/web-shared'

const props = defineProps({
  ws: { type: Object, required: true },
})

const treeRef = ref(null)
const editorRef = ref(null)
const activeNode = ref(null)
const refreshing = ref(false)
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

const rootName = computed(
  () => String(props.ws.root || '').replace(/\/+$/, '').split('/').pop() || '/',
)
const rootNode = computed(() => ({ name: rootName.value, path: '', type: 'dir' }))
const activePath = computed(() => (activeNode.value ? activeNode.value.path : ''))

// 取数函数与行内状态由这一侧给，树的展开与缓存交给共用组件。
const loadLayer = (path) => api.tree(props.ws.id, path)
const downloadOf = (node) => api.downloadUrl(props.ws.id, node.path)
const rowClass = (node) => ({ selected: node.type === 'file' && node.path === activePath.value })
const treeTexts = { truncated: '这一层文件太多，只列了前面一部分。' }

async function reveal(dirPath) {
  await treeRef.value?.reveal(dirPath)
}

// 文件的取数与落盘留在这一侧，编辑器只认路径和文本。
const loadFile = (path) => api.file(props.ws.id, path)
const saveFile = (path, text) => api.save(props.ws.id, path, text)

const held = computed(() => (isHeldNode(activeNode.value) ? activeNode.value : null))

// 过大文件的占位把编辑器整个换掉了，这时没有草稿可问，直接放行。
async function leaveEditor() {
  if (!editorRef.value) return true
  return editorRef.value.confirmLeave()
}

async function show(node, line = 0) {
  if (!(await leaveEditor())) return
  activeNode.value = node
  if (isHeldNode(node)) {
    editorRef.value?.close()
    return
  }
  // 从过大文件的占位切回来时编辑器是刚挂上的，等它出现再打开。
  await nextTick()
  await editorRef.value?.open(node.path, line)
}

function pick(node) {
  return show(node)
}

function openHit(hit) {
  return show({ name: hit.name, path: hit.path, type: 'file', size: hit.size }, hit.line || 0)
}

function downloadHeld() {
  if (!held.value) return
  const link = document.createElement('a')
  link.href = downloadOf(held.value)
  link.download = held.value.name
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

// 右键菜单的新建、改名、删除：弹窗在这里，接口也在这里，目录树只报动作。
const nameAsk = reactive({ on: false, mode: '', node: null, dir: '', value: '', error: '', busy: false })
const delAsk = reactive({ on: false, node: null, error: '', busy: false })

const nameTitle = computed(
  () => ({ file: '新建文件', dir: '新建目录', rename: '重命名' })[nameAsk.mode] || '',
)

const nameLabel = computed(() => {
  if (nameAsk.mode === 'dir') return '目录名'
  if (nameAsk.node && nameAsk.node.type === 'dir') return '目录名'
  return '文件名'
})

function onTreeAction({ action, node }) {
  if (action === 'create-file' || action === 'create-dir') {
    Object.assign(nameAsk, {
      on: true,
      mode: action === 'create-file' ? 'file' : 'dir',
      node,
      dir: node.path,
      value: '',
      error: '',
      busy: false,
    })
    return
  }
  if (action === 'rename') {
    Object.assign(nameAsk, {
      on: true,
      mode: 'rename',
      node,
      dir: dirName(node.path),
      value: node.name,
      error: '',
      busy: false,
    })
    return
  }
  if (action === 'delete') {
    Object.assign(delAsk, { on: true, node, error: '', busy: false })
  }
}

// 当前打开的文件是不是就是它，或者在它底下。
function affectedBy(path) {
  const active = activePath.value
  return !!active && (active === path || active.startsWith(`${path}/`))
}

async function submitName() {
  if (nameAsk.busy) return
  const name = nameAsk.value.trim()
  const problem = entryNameProblem(name)
  if (problem) {
    nameAsk.error = problem
    return
  }
  nameAsk.busy = true
  nameAsk.error = ''
  try {
    if (nameAsk.mode === 'rename') {
      if (!(await doRename(nameAsk.node, name))) return
    } else {
      await doCreate(nameAsk.mode, nameAsk.dir, name)
    }
    nameAsk.on = false
  } catch (err) {
    nameAsk.error = err.message
  } finally {
    nameAsk.busy = false
  }
}

async function doCreate(kind, dir, name) {
  const data =
    kind === 'dir'
      ? await api.mkdir(props.ws.id, dir, name)
      : await api.newFile(props.ws.id, dir, name)
  await treeRef.value?.reveal(dir)
  await treeRef.value?.reloadDir(dir)
  // 新建的文件直接打开；正开着别的文件就不抢，免得把没保存的草稿挤掉。
  if (kind === 'file' && !editorRef.value?.dirty) {
    await show({ name: data.name, path: data.path, type: 'file', size: 0 })
  }
}

async function doRename(node, name) {
  if (name === node.name) return true
  if (affectedBy(node.path) && !(await leaveEditor())) return false
  const active = activePath.value
  const data = await api.renameEntry(props.ws.id, node.path, name)
  await treeRef.value?.reloadDir(dirName(node.path))
  if (active === node.path) {
    activeNode.value = { ...activeNode.value, name: data.name, path: data.path }
    if (!isHeldNode(activeNode.value)) await editorRef.value?.open(data.path)
  } else if (active.startsWith(`${node.path}/`)) {
    const moved = data.path + active.slice(node.path.length)
    activeNode.value = { ...activeNode.value, path: moved }
    if (!isHeldNode(activeNode.value)) await editorRef.value?.open(moved)
  }
  return true
}

async function submitDelete() {
  if (delAsk.busy) return
  const node = delAsk.node
  delAsk.busy = true
  delAsk.error = ''
  try {
    if (affectedBy(node.path) && !(await leaveEditor())) return
    await api.deleteEntry(props.ws.id, node.path)
    if (affectedBy(node.path)) {
      activeNode.value = null
      editorRef.value?.close()
    }
    await treeRef.value?.reloadDir(dirName(node.path))
    delAsk.on = false
  } catch (err) {
    delAsk.error = err.message
  } finally {
    delAsk.busy = false
  }
}

function save() {
  editorRef.value?.save()
}

// 保存成功后刷新：文件大小与目录树里记着的那一份要跟上。
function onSaved({ path, data }) {
  // 保存期间可能已经换到别的文件，那边的内容不能被这份草稿盖掉。
  if (activePath.value === path && activeNode.value) {
    activeNode.value = { ...activeNode.value, size: data.size }
  }
  treeRef.value?.reloadDir(dirName(path))
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

async function refresh() {
  refreshing.value = true
  try {
    if (searching.value) {
      await runSearch()
      return
    }
    await treeRef.value?.refreshAll()
    // 有没保存的改动就不重新读，免得草稿被磁盘上的旧内容盖掉。
    if (activeNode.value && !editorRef.value?.dirty) await editorRef.value?.reload()
  } finally {
    refreshing.value = false
  }
}

function reset() {
  // 树按 ws.id 重建一份，展开状态与缓存不在这里清。
  activeNode.value = null
  editorRef.value?.close()
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
.hint {
  margin: 16px;
  font-size: 0.84rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.hint.bad {
  color: rgb(var(--v-theme-error));
}
.deferred {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px 16px;
  text-align: center;
}
.deferred-icon {
  color: rgb(var(--v-theme-on-surface-variant));
}
.deferred-path {
  max-width: 40rem;
  font-size: 0.84rem;
  word-break: break-all;
}
.deferred-hint {
  max-width: 34rem;
  margin: 0;
  font-size: 0.82rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.ask-path {
  margin: 0 0 8px;
  font-size: 0.82rem;
  word-break: break-all;
}
.ask-hint {
  margin: 0;
  font-size: 0.82rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.ask-error {
  margin: 8px 0 0;
  font-size: 0.82rem;
  color: rgb(var(--v-theme-error));
}
</style>
