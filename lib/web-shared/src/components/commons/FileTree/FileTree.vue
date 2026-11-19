<template>
  <div ref="rootRef" class="file-tree">
    <template v-if="root">
      <FileTreeNode
        :node="root"
        :depth="0"
        :expanded="expanded"
        :cache="cache"
        :key-of="keyOf"
        :dir-of="dirOf"
        :name-of="nameOf"
        :label-class="labelClass"
        :row-class="rowClass"
        :pick-on-row-click="pickOnRowClick"
        :texts="texts"
        @toggle="toggle"
        @pick="emit('pick', $event)"
        @context="openMenu"
      >
        <template #row-before-label="scope">
          <slot name="row-before-label" v-bind="scope" />
        </template>
        <template #row-after-label="scope">
          <slot name="row-after-label" v-bind="scope" />
        </template>
      </FileTreeNode>
    </template>

    <template v-else>
      <!-- 第一层还在读：转个圈，不用文字。 -->
      <div v-if="rootState.loading" class="root-loading">
        <v-progress-circular indeterminate :size="14" :width="2" />
      </div>
      <p v-else-if="rootState.error" class="hint bad">{{ rootState.error }}</p>
      <p v-else-if="!rootState.entries.length" class="hint">{{ text.rootEmpty }}</p>
      <template v-else>
        <FileTreeNode
          v-for="node in rootState.entries"
          :key="keyOf(node)"
          :node="node"
          :depth="0"
          :expanded="expanded"
          :cache="cache"
          :key-of="keyOf"
          :dir-of="dirOf"
          :name-of="nameOf"
          :label-class="labelClass"
          :row-class="rowClass"
          :pick-on-row-click="pickOnRowClick"
          :texts="texts"
          @toggle="toggle"
          @pick="emit('pick', $event)"
          @context="openMenu"
        >
          <template #row-before-label="scope">
            <slot name="row-before-label" v-bind="scope" />
          </template>
          <template #row-after-label="scope">
            <slot name="row-after-label" v-bind="scope" />
          </template>
        </FileTreeNode>
        <p v-if="rootState.truncated" class="hint">{{ text.truncated }}</p>
      </template>
    </template>

    <Teleport to="body">
      <div
        v-if="menu.open"
        ref="menuRef"
        class="ft-menu"
        :style="{ left: menu.x + 'px', top: menu.y + 'px' }"
        @contextmenu.prevent
      >
        <template v-if="editable">
          <button
            v-if="isDirNode"
            class="ft-item"
            type="button"
            @click="run('create-file')"
          >
            <v-icon size="16">mdi-file-plus-outline</v-icon>
            <span>{{ text.newFile }}</span>
          </button>
          <button
            v-if="isDirNode"
            class="ft-item"
            type="button"
            @click="run('create-dir')"
          >
            <v-icon size="16">mdi-folder-plus-outline</v-icon>
            <span>{{ text.newDir }}</span>
          </button>
          <button
            class="ft-item"
            type="button"
            :disabled="!relativePath"
            @click="run('rename')"
          >
            <v-icon size="16">mdi-form-textbox</v-icon>
            <span>{{ text.rename }}</span>
          </button>
          <button
            class="ft-item danger"
            type="button"
            :disabled="!relativePath"
            @click="run('delete')"
          >
            <v-icon size="16">mdi-trash-can-outline</v-icon>
            <span>{{ text.delete }}</span>
          </button>
          <div class="ft-sep" />
        </template>
        <button
          class="ft-item"
          type="button"
          :disabled="!relativePath"
          @click="copyPath('rel')"
        >
          <v-icon size="16">mdi-content-copy</v-icon>
          <span>{{ menu.copied === 'rel' ? text.copied : text.copyRel }}</span>
        </button>
        <button
          v-if="rootPath"
          class="ft-item"
          type="button"
          @click="copyPath('abs')"
        >
          <v-icon size="16">mdi-link-variant</v-icon>
          <span>{{ menu.copied === 'abs' ? text.copied : text.copyAbs }}</span>
        </button>
        <button v-if="downloadOf" class="ft-item" type="button" @click="download">
          <v-icon size="16">{{ isDirNode ? 'mdi-folder-zip-outline' : 'mdi-download' }}</v-icon>
          <span>{{ isDirNode ? text.downloadDir : text.downloadFile }}</span>
        </button>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import FileTreeNode from './FileTreeNode.vue'
import { copyText } from '../../../utils/commons/clipboard.js'

const props = defineProps({
  loader: { type: Function, required: true },
  // 传根节点就在树顶显示这一行（调用方自己给名字与空键），不传就直接列第一层。
  root: { type: Object, default: null },
  keyOf: { type: Function, default: (node) => node.path },
  dirOf: { type: Function, default: (node) => node.type === 'dir' },
  nameOf: { type: Function, default: (node) => node.name },
  labelClass: { type: String, default: '' },
  rowClass: { type: Function, default: null },
  pickOnRowClick: { type: Boolean, default: false },
  // 面板没显示时不读目录，切过来才拉第一层。
  active: { type: Boolean, default: true },
  // 工作区根的绝对路径，有了才显示「复制绝对路径」。
  rootPath: { type: String, default: '' },
  // 节点的下载地址，返回空串表示这一侧不支持下载。
  downloadOf: { type: Function, default: null },
  // 打开右键菜单里的新建、改名、删除；具体怎么做由调用方接 action 事件处理。
  editable: { type: Boolean, default: false },
  texts: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['pick', 'action'])

const DEFAULTS = {
  empty: '空目录',
  truncated: '这一层文件太多，只列了前面一部分。',
  rootEmpty: '空目录',
  copyRel: '复制相对路径',
  copyAbs: '复制绝对路径',
  downloadFile: '下载文件',
  downloadDir: '下载目录（zip）',
  copied: '已复制',
  newFile: '新建文件',
  newDir: '新建目录',
  rename: '重命名',
  delete: '删除',
}
const text = computed(() => ({ ...DEFAULTS, ...props.texts }))
const EMPTY = { loading: false, error: '', entries: [], truncated: false }

// 展开状态与读过的孩子各存一份，节点自己不带副本。
const expanded = reactive({})
const cache = reactive({})
const started = ref(false)
const rootRef = ref(null)

const rootKey = computed(() => (props.root ? props.keyOf(props.root) : ''))
const rootState = computed(() => cache[rootKey.value] || EMPTY)

async function load(key, force = false) {
  if (!force && cache[key]) return
  if (!cache[key]) cache[key] = { loading: false, error: '', entries: [], truncated: false }
  const state = cache[key]
  state.loading = true
  state.error = ''
  try {
    const data = await props.loader(key)
    state.entries = data.entries || []
    state.truncated = data.truncated || false
  } catch (err) {
    state.error = err.message
    state.entries = []
  } finally {
    state.loading = false
  }
}

function toggle(key) {
  expanded[key] = !expanded[key]
  if (expanded[key]) load(key)
}

// 从根往下逐层展开到指定路径，搜索命中与面包屑都走这里。
async function reveal(key) {
  expanded[rootKey.value] = true
  await load(rootKey.value)
  let prefix = rootKey.value
  for (const seg of String(key || '').split('/').filter(Boolean)) {
    prefix = prefix ? `${prefix}/${seg}` : seg
    await load(prefix)
    expanded[prefix] = true
  }
}

// 展开到哪些目录可以整份取出、放回：调用方换走再回来时接着摊开原来的层次。
function expandedKeys() {
  return Object.keys(expanded).filter((key) => expanded[key])
}

async function restoreExpanded(keys) {
  const list = Array.isArray(keys) ? keys : []
  await Promise.all(
    list.map(async (key) => {
      expanded[key] = true
      await load(key)
    })
  )
}

// 一键收起：除了根，展开过的目录都合上；读过的孩子还留在缓存里，再展开不用重读。
function collapseAll() {
  for (const key of Object.keys(expanded)) expanded[key] = false
  expanded[rootKey.value] = true
}

// 全量重读：展开状态一并清掉，回到只看第一层。
function reload() {
  for (const key of Object.keys(cache)) delete cache[key]
  for (const key of Object.keys(expanded)) delete expanded[key]
  expanded[rootKey.value] = true
  load(rootKey.value)
}

async function reloadDir(key) {
  await load(key, true)
}

// 把某一行滚进视口：切换页签时左侧树跟着定位，行按路径找，不用拼选择器。
function scrollTo(key) {
  const rows = rootRef.value ? rootRef.value.querySelectorAll('[data-path]') : []
  for (const row of rows) {
    if (row.dataset.path !== key) continue
    row.scrollIntoView({ block: 'nearest' })
    return
  }
}

async function refreshAll() {
  await Promise.all(Object.keys(cache).map((key) => load(key, true)))
}

function activate() {
  if (!props.active || started.value) return
  started.value = true
  expanded[rootKey.value] = true
  load(rootKey.value)
}

if (props.active) activate()
onMounted(activate)
watch(
  () => props.active,
  (on) => {
    if (on) activate()
  },
)

const menu = reactive({ open: false, x: 0, y: 0, node: null, copied: '' })
const menuRef = ref(null)
let copyTimer = 0

const relativePath = computed(() => (menu.node ? String(props.keyOf(menu.node) || '') : ''))
const absolutePath = computed(() => {
  if (!menu.node || !props.rootPath) return ''
  const root = props.rootPath.replace(/\/+$/, '')
  const rel = relativePath.value
  return rel ? `${root}/${rel}` : root
})
const isDirNode = computed(() => (menu.node ? props.dirOf(menu.node) : false))

function openMenu({ node, event }) {
  menu.node = node
  menu.copied = ''
  menu.x = event.clientX
  menu.y = event.clientY
  menu.open = true
  nextTick(clampMenu)
}

// 贴着窗口边缘弹会超出视口，量到实际尺寸后往里收。
function clampMenu() {
  if (!menuRef.value) return
  const gap = 6
  const width = menuRef.value.offsetWidth
  const height = menuRef.value.offsetHeight
  menu.x = Math.max(gap, Math.min(menu.x, window.innerWidth - width - gap))
  menu.y = Math.max(gap, Math.min(menu.y, window.innerHeight - height - gap))
}

function closeMenu() {
  menu.open = false
  menu.node = null
  menu.copied = ''
  clearTimeout(copyTimer)
}

async function copyPath(kind) {
  const text = kind === 'abs' ? absolutePath.value : relativePath.value
  if (!text || !(await copyText(text))) return
  menu.copied = kind
  clearTimeout(copyTimer)
  copyTimer = setTimeout(closeMenu, 700)
}

// 增删改交给调用方：菜单只报动作与节点，弹窗与接口都在各自面板里。
function run(action) {
  if (!menu.node) return
  const node = menu.node
  closeMenu()
  emit('action', { action, node })
}

function download() {
  if (!menu.node || !props.downloadOf) return
  const node = menu.node
  const url = props.downloadOf(node)
  closeMenu()
  if (!url) return
  const name = props.nameOf(node) || 'download'
  const link = document.createElement('a')
  link.href = url
  link.download = props.dirOf(node) ? `${name}.zip` : name
  link.rel = 'noopener'
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

function onDocumentDown(event) {
  if (menuRef.value && !menuRef.value.contains(event.target)) closeMenu()
}

function onDocumentKey(event) {
  if (event.key === 'Escape') closeMenu()
}

function onViewportChange() {
  if (menu.open) closeMenu()
}

function bindMenu(hold) {
  const method = hold ? 'addEventListener' : 'removeEventListener'
  document[method]('mousedown', onDocumentDown, true)
  document[method]('keydown', onDocumentKey, true)
  window[method]('scroll', onViewportChange, true)
  window[method]('resize', onViewportChange)
}

watch(
  () => menu.open,
  (on) => bindMenu(on),
)

onBeforeUnmount(() => {
  closeMenu()
  bindMenu(false)
})

defineExpose({
  reveal,
  reload,
  reloadDir,
  refreshAll,
  scrollTo,
  toggle,
  collapseAll,
  expandedKeys,
  restoreExpanded,
})
</script>

<style scoped>
.file-tree {
  min-width: 0;
}
.hint {
  margin: 2px 0 2px 30px;
  font-size: 0.76rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.root-loading {
  display: flex;
  padding: 6px 0 6px 36px;
}
.hint.bad {
  color: rgb(var(--v-theme-error));
}
.ft-menu {
  position: fixed;
  z-index: 3000;
  min-width: 178px;
  padding: 4px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 8px;
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.28);
}
.ft-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 10px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: rgb(var(--v-theme-on-surface));
  font-size: 0.82rem;
  text-align: left;
  cursor: pointer;
}
.ft-item:hover {
  background: rgba(var(--v-theme-on-surface), 0.08);
}
.ft-item:disabled {
  opacity: 0.45;
  cursor: default;
}
.ft-item:disabled:hover {
  background: none;
}
.ft-item .v-icon {
  color: rgb(var(--v-theme-on-surface-variant));
}
.ft-item.danger {
  color: rgb(var(--v-theme-error));
}
.ft-item.danger .v-icon {
  color: inherit;
}
.ft-sep {
  height: 1px;
  margin: 4px 6px;
  background: rgba(var(--v-theme-on-surface), 0.12);
}
</style>
