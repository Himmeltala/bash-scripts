<!--
 * @Author: Himmeltala
 * @Date: 2026-11-12 18:48:07
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-19 00:00:15
 * @FilePath: \dvcsx\web\src\components\BrowsePanel.vue
 * @Description: 浏览工作副本目录，预览、编辑、新建、重命名与删除文件。
-->
<template>
  <div class="panel" @keydown.ctrl.s.prevent="save">
    <div class="bar">
      <div class="left">
        <v-text-field
          :model-value="query"
          density="compact"
          variant="outlined"
          hide-details
          clearable
          placeholder="搜索文件名或文件内容"
          prepend-inner-icon="mdi-magnify"
          class="search"
          @update:model-value="query = $event ?? ''"
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
          <v-btn value="name" size="small" title="只看文件本身的名字，不看所在目录">文件名</v-btn>
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
      <v-progress-circular v-if="defining" indeterminate size="16" class="busy" />
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

    <div v-if="notice" class="notice">
      <span class="notice-text">{{ notice }}</span>
      <button type="button" class="notice-close" title="关掉" @click="notice = ''">
        <v-icon size="14">mdi-close</v-icon>
      </button>
    </div>

    <div ref="splitRef" class="body" :class="{ resizing }">
      <aside class="tree" :style="{ '--tree-width': `${treeWidth}px` }">
        <div v-if="!searching" class="tree-tools">
          <v-btn
            icon="mdi-collapse-all-outline"
            size="x-small"
            variant="text"
            title="全部收起已展开的目录"
            @click="collapseAll"
          />
        </div>
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
          <div v-for="row in resultRows" :key="`${row.type}:${row.path}`" class="snode">
            <div
              class="srow"
              :class="{
                dir: row.type === 'dir',
                active: row.type === 'file' && activePath === row.path,
              }"
              :style="{ paddingLeft: `${10 + row.depth * 14}px` }"
              :title="row.path"
              @click="onResultRow(row)"
            >
              <v-icon v-if="row.type === 'dir'" size="16" class="sicon">
                {{ collapsedDirs.has(row.path) ? 'mdi-chevron-right' : 'mdi-chevron-down' }}
              </v-icon>
              <v-icon
                v-else
                size="16"
                class="sicon"
                :style="iconOf(row).color ? { color: iconOf(row).color } : null"
              >
                {{ iconOf(row).icon }}
              </v-icon>
              <span class="sname mono">{{ row.name }}</span>
              <span v-if="row.type === 'file' && row.hits.length > 1" class="scount">
                {{ row.hits.length }}
              </span>
            </div>
            <div
              v-for="hit in row.hits || []"
              :key="hit.line"
              class="shit"
              :style="{ paddingLeft: `${10 + (row.depth + 1) * 14}px` }"
              @click="openResultHit(row, hit)"
            >
              <span class="shit-line mono">{{ hit.line }}</span>
              <span class="shit-text mono">{{ hit.text }}</span>
            </div>
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
                @definition="onDefinition"
                @menu="openSymbolMenu"
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

    <FloatingDialog
      v-model="defAsk.on"
      :initial-width="560"
      :initial-height="400"
      :min-width="380"
      :min-height="240"
    >
      <template #title>「{{ defAsk.word }}」的{{ defAsk.title }}</template>
      <p class="ask-hint">找到 {{ defAsk.list.length }} 处，选一个跳过去。</p>
      <div class="def-list">
        <button
          v-for="loc in defAsk.list"
          :key="`${loc.path}:${loc.line}:${loc.character}`"
          type="button"
          class="def-item"
          @click="openLocation(loc)"
        >
          <v-icon size="16">mdi-file-outline</v-icon>
          <span class="mono def-path">{{ loc.path }}</span>
          <span class="mono def-line">{{ loc.line + 1 }}</span>
        </button>
      </div>
      <template #actions>
        <v-spacer />
        <v-btn variant="text" @click="defAsk.on = false">取消</v-btn>
      </template>
    </FloatingDialog>

    <div
      v-if="symMenu.on"
      class="sym-menu"
      :style="{ left: `${symMenu.x}px`, top: `${symMenu.y}px` }"
    >
      <button type="button" class="sym-item" @click="runSymbol('definition')">转到定义</button>
      <button type="button" class="sym-item" @click="runSymbol('typeDefinition')">
        转到类型定义
      </button>
      <button type="button" class="sym-item" @click="runSymbol('implementation')">
        转到实现
      </button>
      <button type="button" class="sym-item" @click="runSymbol('references')">查找引用</button>
      <div class="sym-sep" />
      <button type="button" class="sym-item" @click="runSymbol('copy')">复制标识符</button>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { api } from '../composables/useApi'
import { FileEditor, FileTree, copyText, fileIcon } from '@bash-scripts/web-shared'
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
import { saveSession, sessionOf } from '../composables/browseSessions'
import { buildSearchTree, flattenSearchTree } from '../composables/browseSearchTree'
import { dirName } from '../composables/format'
import { usePreferencesStore } from '../stores/preferences'
import { useSplitPane } from '@bash-scripts/web-shared'

const props = defineProps({
  ws: { type: Object, required: true },
})

const treeRef = ref(null)
const tabbarRef = ref(null)
// 打开过的文件各占一个页签，每个页签一个编辑器实例：草稿、视图与滚动都留在各自那份里。
// 面板换走再回来（换工作区、切到别的页签）接上次的样子：页签、停的位置与没保存的草稿都按工作区留着。
const kept = sessionOf(props.ws.id)
const tabs = ref(kept ? kept.tabs : [])
const activePath = ref(kept ? kept.active : '')
const drafts = new Map(kept && kept.drafts ? kept.drafts : [])
// 左侧树上次展开到哪些目录；换回这个工作区时原样摊开。
const keptExpanded = kept && kept.expanded ? kept.expanded : []
const editors = new Map()
const activeTab = computed(() => tabOf(tabs.value, activePath.value))
const refreshing = ref(false)
// 代码索引：查定义时的转圈、顶栏提示条，以及多个候选时的那张列表。
const defining = ref(false)
const notice = ref('')
let noticeTimer = 0
const defAsk = reactive({ on: false, word: '', title: '定义', list: [] })
// 右键标识符弹出的代码菜单：位置、词，以及来源文件与行列。
const symMenu = reactive({ on: false, x: 0, y: 0, path: '', line: 0, character: 0, word: '' })
const SYMBOL_TITLES = {
  definition: '定义',
  typeDefinition: '类型定义',
  implementation: '实现',
  references: '引用',
}
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
const searching = computed(() => String(query.value ?? '').trim() !== '')
const search = reactive({ loading: false, error: '', matches: [], truncated: false, mode: 'name' })
// 结果按目录归成树；收起的目录记在这里，重新搜一次就从全展开开始。
const collapsedDirs = ref(new Set())
const resultRows = computed(() =>
  flattenSearchTree(buildSearchTree(search.matches), collapsedDirs.value)
)
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

// 一键收起左树：只合上当前展开的目录，根那层留着，读过的目录还在缓存里。
function collapseAll() {
  treeRef.value?.collapseAll()
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

// 换走时把还活着的编辑器里的草稿取出来；还没读过内容的页签不动，草稿本来就还在。
function takeDrafts() {
  for (const tab of tabs.value) {
    const editor = editorOf(tab.path)
    if (!editor || !editor.path) continue
    if (editor.dirty) drafts.set(tab.path, editor.text)
    else drafts.delete(tab.path)
  }
}

// 回到旧页签：文件读进来之后把草稿放回去，未保存标记跟着回来。
// 磁盘上已经是这份草稿时不用放，标记也要落回干净，别留着一个假的未保存。
function restoreDraft(path, editor) {
  const text = drafts.get(path)
  if (text !== undefined && editor.text !== text) editor.restore(text)
  setDirty(path, editor.dirty)
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
  // 实例还没读过内容（新页签、回到旧页签，或刚从过大文件的占位换回编辑器），读一遍。
  if (!editor.path) {
    if (await editor.open(node.path, line)) restoreDraft(node.path, editor)
    return
  }
  if (!line) return
  // 跳行要按新位置重读文件，草稿还在就先问一句。
  if (editor.dirty && !(await editor.confirmLeave())) return
  await editor.open(node.path, line)
}

// 点开另一个页签：回到旧工作区时只读过停着的那一个，其余的等点到再读。
async function activate(tab) {
  activePath.value = tab.path
  await nextTick()
  const editor = editorOf(tab.path)
  if (!editor || editor.path) return
  if (await editor.open(tab.path)) restoreDraft(tab.path, editor)
}

// 关页签：没保存的问一句再关，关的是当前就停到旁边那个。
async function closeTab(tab) {
  const editor = editorOf(tab.path)
  if (editor && editor.dirty && !(await editor.confirmLeave())) return
  const before = activePath.value
  const result = closeTabIn(tabs.value, tab.path, before)
  tabs.value = result.tabs
  drafts.delete(tab.path)
  if (result.active !== before) activePath.value = result.active
}

function pick(node) {
  return show(node)
}

// Ctrl+点击取到的词去问语言服务器：一条直接跳，多条列出来选，零条或出错在顶栏说明。
async function onDefinition({ path, line, character, word }) {
  if (!path) return
  const editor = editorOf(path)
  if (!editor) return
  defining.value = true
  try {
    const data = await api.definition(props.ws.id, path, editor.text, line, character)
    const list = (data && data.locations) || []
    if (!list.length) {
      flash(`没找到「${word}」的定义`)
      return
    }
    if (list.length === 1) {
      await openLocation(list[0])
      return
    }
    defAsk.word = word
    defAsk.title = '定义'
    defAsk.list = list
    defAsk.on = true
  } catch (err) {
    flash(err.message)
  } finally {
    defining.value = false
  }
}

// 右键标识符：在鼠标位置摆出代码菜单，点别处或按 Esc 收起。
function openSymbolMenu(payload) {
  symMenu.x = Math.max(0, Math.min(payload.x, window.innerWidth - 208))
  symMenu.y = Math.max(0, Math.min(payload.y, window.innerHeight - 220))
  symMenu.path = payload.path
  symMenu.line = payload.line
  symMenu.character = payload.character
  symMenu.word = payload.word
  symMenu.on = true
}

function closeSymbolMenu() {
  symMenu.on = false
}

function onMenuOutside(event) {
  const target = event.target
  if (target && target.closest && target.closest('.sym-menu')) return
  closeSymbolMenu()
}

function onMenuKey(event) {
  if (event.key === 'Escape') closeSymbolMenu()
}

watch(
  () => symMenu.on,
  (on) => {
    if (on) {
      window.addEventListener('mousedown', onMenuOutside, true)
      window.addEventListener('keydown', onMenuKey, true)
    } else {
      window.removeEventListener('mousedown', onMenuOutside, true)
      window.removeEventListener('keydown', onMenuKey, true)
    }
  }
)

// 菜单里的动作：复制本地做，其余交给服务端问语言服务器。
async function runSymbol(action) {
  const item = {
    path: symMenu.path,
    line: symMenu.line,
    character: symMenu.character,
    word: symMenu.word,
  }
  closeSymbolMenu()
  if (action === 'copy') {
    try {
      await copyText(item.word)
      flash(`已复制「${item.word}」`)
    } catch (err) {
      flash(err.message || '复制失败')
    }
    return
  }
  const editor = editorOf(item.path)
  if (!editor) return
  const title = SYMBOL_TITLES[action] || '定义'
  defining.value = true
  try {
    const data = await api.query(
      props.ws.id, item.path, editor.text, item.line, item.character, action
    )
    const list = (data && data.locations) || []
    if (!list.length) {
      flash(`没有找到「${item.word}」的${title}`)
      return
    }
    if (list.length === 1) {
      await openLocation(list[0])
      return
    }
    defAsk.word = item.word
    defAsk.title = title
    defAsk.list = list
    defAsk.on = true
  } catch (err) {
    flash(err.message)
  } finally {
    defining.value = false
  }
}

// 跳到定义处：可能是别的文件，新开一个页签并按行定位。
async function openLocation(loc) {
  defAsk.on = false
  await show(
    { path: loc.path, name: loc.path.split('/').pop(), type: 'file' },
    (loc.line || 0) + 1
  )
}

function flash(text) {
  notice.value = text
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => {
    notice.value = ''
  }, 8000)
}

// 点目录行收起或展开，点文件行开到第一处命中，点命中行开到那一行。
function toggleResultDir(path) {
  const next = new Set(collapsedDirs.value)
  if (next.has(path)) next.delete(path)
  else next.add(path)
  collapsedDirs.value = next
}

function onResultRow(row) {
  if (row.type === 'dir') {
    toggleResultDir(row.path)
    return
  }
  const hit = row.hits[0]
  openHit({ name: row.name, path: row.path, size: row.size, line: hit ? hit.line : 0 })
}

function openResultHit(row, hit) {
  openHit({ name: row.name, path: row.path, size: row.size, line: hit.line })
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
  // 旧路径的草稿已经问过、跟着页签一起作废；页签换了键，编辑器重新挂上后按新路径读一次。
  for (const item of renamed.moved) drafts.delete(item.from)
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
      drafts.delete(tab.path)
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

async function runSearch() {
  clearTimeout(searchTimer)
  const text = String(query.value ?? '').trim()
  if (!text) return
  const mine = ++searchSeq
  search.loading = true
  search.error = ''
  try {
    const data = await api.search(props.ws.id, text, mode.value)
    if (mine !== searchSeq) return
    search.matches = data.matches || []
    search.truncated = !!data.truncated
    collapsedDirs.value = new Set()
  } catch (err) {
    if (mine !== searchSeq) return
    search.matches = []
    search.truncated = false
    search.error = err.message
    collapsedDirs.value = new Set()
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

// 回来时把树摊回原来的层次，读出停着的那一个页签，草稿跟着放回去；其余页签等点开再读。
onMounted(async () => {
  if (keptExpanded.length) treeRef.value?.restoreExpanded(keptExpanded)
  const tab = tabOf(tabs.value, activePath.value) || tabs.value[0] || null
  if (!tab) return
  if (tab.path !== activePath.value) activePath.value = tab.path
  await show(tab)
  locate(activePath.value)
})

// 换走之前把页签、草稿与树的展开层次收进这个工作区的 session，下次回来接着用。
onBeforeUnmount(() => {
  takeDrafts()
  saveSession(props.ws.id, {
    tabs: tabs.value.map((tab) => ({ ...tab, dirty: drafts.has(tab.path) })),
    active: activePath.value,
    drafts,
    expanded: treeRef.value ? treeRef.value.expandedKeys() : keptExpanded,
  })
  clearTimeout(searchTimer)
  clearTimeout(noticeTimer)
  window.removeEventListener('mousedown', onMenuOutside, true)
  window.removeEventListener('keydown', onMenuKey, true)
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
.busy {
  flex: 0 0 auto;
  margin-right: 4px;
}
.notice {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  background: rgba(var(--v-theme-warning), 0.14);
  font-size: 0.78rem;
}
.notice-text {
  flex: 1 1 auto;
  min-width: 0;
  word-break: break-word;
}
.notice-close {
  flex: 0 0 auto;
  display: flex;
  padding: 2px;
  border: 0;
  border-radius: 4px;
  background: none;
  color: inherit;
  cursor: pointer;
  opacity: 0.7;
}
.notice-close:hover {
  opacity: 1;
  background: rgba(var(--v-theme-on-surface), 0.12);
}
.def-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 0;
  overflow: auto;
}
.def-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: inherit;
  font-size: 0.8rem;
  text-align: left;
  cursor: pointer;
}
.def-item:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
}
.def-path {
  flex: 1 1 auto;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.def-line {
  flex: 0 0 auto;
  font-size: 0.74rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.sym-menu {
  position: fixed;
  z-index: 3000;
  min-width: 196px;
  padding: 4px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 8px;
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.24);
}
.sym-item {
  display: block;
  width: 100%;
  padding: 7px 10px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: inherit;
  font-size: 0.8rem;
  text-align: left;
  cursor: pointer;
}
.sym-item:hover {
  background: rgba(var(--v-theme-primary), 0.12);
}
.sym-sep {
  height: 1px;
  margin: 4px 6px;
  background: rgba(var(--v-theme-on-surface), 0.1);
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
.srow {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.07);
  font-size: 0.78rem;
  cursor: pointer;
}
.srow:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
}
.srow.active {
  background: rgba(var(--v-theme-primary), 0.14);
}
.srow.dir {
  font-weight: 500;
}
.sicon {
  flex: 0 0 auto;
}
.sname {
  flex: 1 1 auto;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.scount {
  flex: 0 0 auto;
  font-size: 0.68rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.shit {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 1px 10px 3px;
  font-size: 0.72rem;
  cursor: pointer;
}
.shit:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
}
.shit-line {
  flex: 0 0 auto;
  min-width: 2.4em;
  text-align: right;
  color: rgb(var(--v-theme-on-surface-variant));
}
.shit-text {
  flex: 1 1 auto;
  min-width: 0;
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
/* 树顶那排按钮平时藏起来，鼠标移进左树才露出来；停靠顶部，树往下滚也够得着。 */
.tree-tools {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  justify-content: flex-end;
  height: 24px;
  margin: -6px -4px 0;
  padding: 0 4px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s;
}
.tree:hover .tree-tools {
  opacity: 1;
  pointer-events: auto;
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
