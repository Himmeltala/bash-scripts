<!--
 * @Author: Himmeltala
 * @Date: 2026-11-12 18:48:07
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-17 23:14:15
 * @FilePath: \dvcsx\web\src\components\BrowsePanel.vue
 * @Description: 浏览工作副本目录，预览、编辑、新建、重命名与删除文件。
-->
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

      <div class="main">
        <div v-if="tabs.length" ref="tabbarRef" class="tabbar">
          <div
            v-for="tab in tabs"
            :key="tab.path"
            class="tab"
            :class="{ active: tab.path === activePath }"
            :data-path="tab.path"
            :title="tab.path"
            @click="activate(tab)"
            @mousedown.middle.prevent="closeTab(tab)"
          >
            <v-icon
              size="14"
              class="tab-icon"
              :style="tabIcon(tab).color ? { color: tabIcon(tab).color } : null"
            >
              {{ tabIcon(tab).icon }}
            </v-icon>
            <span class="tab-name">{{ tab.name }}</span>
            <span v-if="tab.dirty" class="tab-dirty" title="还没保存" />
            <button
              class="tab-close"
              type="button"
              :title="`关闭 ${tab.name}`"
              @click.stop="closeTab(tab)"
            >
              <v-icon size="14">mdi-close</v-icon>
            </button>
          </div>
        </div>

        <div class="panes">
          <template v-if="tabs.length">
            <div
              v-for="tab in tabs"
              v-show="tab.path === activePath"
              :key="tab.path"
              class="pane"
            >
              <EmptyState
                v-if="isHeldNode(tab)"
                icon="mdi-file-hidden"
                :icon-size="28"
                :path="tab.path"
                :hint="`这个文件有 ${formatBytes(tab.size)}，超过 ${formatBytes(PREVIEW_MAX)} 的预览上限，默认不加载。`"
                action="下载文件"
                action-icon="mdi-download"
                @action="downloadHeld"
              />
              <FileEditor
                v-else
                :ref="(el) => setEditor(tab.path, el)"
                :root-name="rootName"
                :size="tab.size"
                :loader="loadFile"
                :saver="saveFile"
                @navigate="reveal"
                @saved="onSaved"
                @dirty="(on) => setDirty(tab.path, on)"
              />
            </div>
          </template>
          <EmptyState
            v-else
            icon="mdi-file-outline"
            hint="从左边选一个文件，右边显示它的内容。"
          />
        </div>
      </div>
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
import { FileEditor, FileTree, fileIcon } from '@bash-scripts/web-shared'
import { EmptyState, SplitHandle } from '@bash-scripts/web-shared/layouts'
import { FloatingDialog } from '@bash-scripts/web-shared/feedbacks'
import { formatBytes } from '@bash-scripts/web-shared/format'
import { PREVIEW_MAX, entryNameProblem, isHeldNode } from '../composables/browseOps'
import {
  closeTab as closeTabIn,
  followMoved,
  openTab as openTabIn,
  renameTabs,
  tabOf,
  updateTab,
} from '../composables/browseTabs'
import { dirName } from '../composables/format'
import { usePreferencesStore } from '../stores/preferences'
import { useSplitPane } from '@bash-scripts/web-shared'

const props = defineProps({
  ws: { type: Object, required: true },
})

const treeRef = ref(null)
const tabbarRef = ref(null)
// 打开过的文件各占一个页签，每个页签一个编辑器实例：草稿、视图与滚动都留在各自那份里。
const tabs = ref([])
const activePath = ref('')
const editors = new Map()
const activeTab = computed(() => tabOf(tabs.value, activePath.value))
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

const held = computed(() => (isHeldNode(activeTab.value) ? activeTab.value : null))

// 页签与编辑器实例对起来：挂载时登记，卸载时按挂载时那个路径注销。
function setEditor(path, el) {
  if (el) editors.set(path, el)
  else editors.delete(path)
}

function editorOf(path) {
  return editors.get(path) || null
}

function setDirty(path, on) {
  const tab = tabOf(tabs.value, path)
  if (!tab || tab.dirty === on) return
  tabs.value = updateTab(tabs.value, path, { dirty: on })
}

function tabIcon(tab) {
  return fileIcon(tab.name)
}

// 切换页签时左侧树跟着走：展开到所在目录，把这一行滚进视野；搜索时树是藏着的，等退出搜索再定位。
async function locate(path) {
  if (!path) return
  await nextTick()
  const rows = tabbarRef.value?.querySelectorAll('[data-path]')
  for (const el of rows || []) {
    if (el.dataset.path !== path) continue
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    break
  }
  if (searching.value) return
  await treeRef.value?.reveal(dirName(path))
  if (activePath.value !== path) return
  await nextTick()
  treeRef.value?.scrollTo(path)
}

// 打开文件：已经开着就切过去，草稿、视图与滚动都还留在那个实例里；没开过就新加一个页签。
async function show(node, line = 0) {
  const found = tabOf(tabs.value, node.path)
  if (!found) tabs.value = openTabIn(tabs.value, node)
  else if (node.size !== undefined && node.size !== found.size) {
    tabs.value = updateTab(tabs.value, node.path, { size: node.size })
  }
  activePath.value = node.path
  await nextTick()
  const editor = editorOf(node.path)
  // 过大文件只有下载占位，没有编辑器可开。
  if (!editor) return
  // 实例还没读过内容（新页签，或刚从过大文件的占位换回编辑器），读一遍。
  if (!editor.path) {
    await editor.open(node.path, line)
    return
  }
  if (!line) return
  // 跳行要按新位置重读文件，草稿还在就先问一句。
  if (editor.dirty && !(await editor.confirmLeave())) return
  await editor.open(node.path, line)
}

function activate(tab) {
  activePath.value = tab.path
}

// 关页签：没保存的问一句再关，关的是当前就停到旁边那个。
async function closeTab(tab) {
  const editor = editorOf(tab.path)
  if (editor && editor.dirty && !(await editor.confirmLeave())) return
  const before = activePath.value
  const result = closeTabIn(tabs.value, tab.path, before)
  tabs.value = result.tabs
  if (result.active !== before) activePath.value = result.active
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

watch(activePath, (path) => locate(path))
watch(searching, (on) => {
  if (!on) locate(activePath.value)
})

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

// 改名与删除会动到磁盘上的文件：动到哪个页签，就先把那个页签的草稿问清楚。
function affectedTabs(path) {
  return tabs.value.filter((tab) => tab.path === path || tab.path.startsWith(`${path}/`))
}

async function leaveTabs(list) {
  for (const tab of list) {
    const editor = editorOf(tab.path)
    if (editor && editor.dirty && !(await editor.confirmLeave())) return false
  }
  return true
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
  // 新建的文件直接开一个页签；别的页签的草稿都还在自己那边，不会被挤掉。
  if (kind === 'file') {
    await show({ name: data.name, path: data.path, type: 'file', size: 0 })
  }
}

async function doRename(node, name) {
  if (name === node.name) return true
  if (!(await leaveTabs(affectedTabs(node.path)))) return false
  const data = await api.renameEntry(props.ws.id, node.path, name)
  await treeRef.value?.reloadDir(dirName(node.path))
  const before = activePath.value
  const renamed = renameTabs(tabs.value, node.path, data.path, data.name)
  tabs.value = renamed.tabs
  activePath.value = followMoved(renamed.moved, before)
  // 页签换了键，编辑器是重新挂上的，按新路径再读一次。
  await nextTick()
  for (const item of renamed.moved) {
    await editorOf(item.to)?.open(item.to)
  }
  return true
}

async function submitDelete() {
  if (delAsk.busy) return
  const node = delAsk.node
  delAsk.busy = true
  delAsk.error = ''
  try {
    const touched = affectedTabs(node.path)
    if (!(await leaveTabs(touched))) return
    await api.deleteEntry(props.ws.id, node.path)
    // 删掉的文件在哪个页签上开着，就一并关掉，停到旁边剩下的那个。
    let next = activePath.value
    for (const tab of touched) {
      const result = closeTabIn(tabs.value, tab.path, next)
      tabs.value = result.tabs
      next = result.active
    }
    if (next !== activePath.value) activePath.value = next
    await treeRef.value?.reloadDir(dirName(node.path))
    delAsk.on = false
  } catch (err) {
    delAsk.error = err.message
  } finally {
    delAsk.busy = false
  }
}

function save() {
  editorOf(activePath.value)?.save()
}

// 保存成功后刷新：页签与目录树里记着的那一份要跟上。
function onSaved({ path, data }) {
  // 保存期间可能已经切到别的页签，那边的内容不能被这份草稿盖掉。
  if (tabOf(tabs.value, path)) tabs.value = updateTab(tabs.value, path, { size: data.size })
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
    const editor = editorOf(activePath.value)
    if (editor && !editor.dirty) await editor.reload()
  } finally {
    refreshing.value = false
  }
}

function reset() {
  // 树按 ws.id 重建一份，展开状态与缓存不在这里清。
  tabs.value = []
  activePath.value = ''
  editors.clear()
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
.main {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.tabbar {
  flex: 0 0 auto;
  display: flex;
  overflow-x: auto;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}
.tabbar::-webkit-scrollbar {
  height: 6px;
}
.tab {
  flex: 0 0 auto;
  max-width: 220px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 6px 6px 10px;
  border-right: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.78rem;
  cursor: pointer;
  user-select: none;
}
.tab:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
}
.tab.active {
  color: rgb(var(--v-theme-on-surface));
  background: rgb(var(--v-theme-surface));
  box-shadow: inset 0 -2px 0 rgb(var(--v-theme-primary));
}
.tab-icon {
  flex: 0 0 auto;
}
.tab-name {
  flex: 0 1 auto;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tab-dirty {
  flex: 0 0 auto;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgb(var(--v-theme-modified));
}
.tab-close {
  flex: 0 0 auto;
  display: flex;
  padding: 1px;
  border: 0;
  border-radius: 4px;
  background: none;
  color: inherit;
  opacity: 0;
  cursor: pointer;
}
.tab:hover .tab-close,
.tab.active .tab-close {
  opacity: 0.7;
}
.tab .tab-close:hover {
  opacity: 1;
  background: rgba(var(--v-theme-on-surface), 0.12);
}
.panes {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
}
.pane {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
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
