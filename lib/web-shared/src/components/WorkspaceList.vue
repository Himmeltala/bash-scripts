<template>
  <div class="list" @contextmenu.prevent.stop="blankMenu">
    <div class="head">
      <span class="head-title">{{ labels.headTitle }}</span>
      <v-btn
        size="small"
        variant="text"
        color="primary"
        prepend-icon="mdi-plus"
        :loading="busy"
        @click="openDialog"
      >
        {{ labels.add }}
      </v-btn>
    </div>

    <div v-if="!workspaces.length && !groupCount" class="none">{{ labels.empty }}</div>

    <v-list density="compact" nav class="items" @drop.prevent="dropRow">
      <v-list-item
        v-for="row in rows"
        :key="row.key"
        :active="row.kind === 'ws' && row.id === current"
        active-color="primary"
        draggable="true"
        :style="{ paddingLeft: `${12 + row.depth * 12}px` }"
        :class="rowClass(row)"
        @click="rowClick(row)"
        @contextmenu.prevent.stop="rowMenu($event, row)"
        @dragstart="dragStart($event, row)"
        @dragover.prevent="dragOver($event, row)"
        @dragend="dragEnd"
      >
        <v-list-item-title v-if="row.kind === 'group'" class="gname">
          <v-icon size="16">
            {{ collapsedIds.has(row.id) ? 'mdi-chevron-right' : 'mdi-chevron-down' }}
          </v-icon>
          <v-icon size="16">mdi-folder-outline</v-icon>
          <span class="gtext">{{ row.name }}</span>
        </v-list-item-title>
        <template v-else>
          <v-list-item-title class="name" :title="row.ws.alias ? row.ws.root : ''">
            <span class="nm">{{ row.ws.alias || baseName(row.ws.root) }}</span>
            <slot name="title-extra" :ws="row.ws" />
          </v-list-item-title>
          <v-list-item-subtitle class="path" :title="row.ws.url || row.ws.root">
            {{ row.ws.url || row.ws.root }}
          </v-list-item-subtitle>
        </template>
        <template #append>
          <v-btn
            v-if="row.kind === 'ws'"
            :icon="true"
            size="x-small"
            variant="text"
            :title="labels.forgetTitle"
            class="forget"
            @click.stop="confirm(row.ws)"
          >
            <v-icon size="18">mdi-close</v-icon>
          </v-btn>
        </template>
      </v-list-item>
    </v-list>

    <div
      v-if="menu.open"
      class="ctxmenu"
      :style="{ left: menu.x + 'px', top: menu.y + 'px' }"
      @click.stop
      @contextmenu.prevent.stop
    >
      <template v-if="menu.mode === 'ws'">
        <button type="button" class="ctxitem" @click="startAlias(menu.target)">
          <v-icon size="16">mdi-rename-box</v-icon>{{ labels.menuAlias }}
        </button>
        <button type="button" class="ctxitem" @click="copyPath(menu.target, 'rel')">
          <v-icon size="16">mdi-content-copy</v-icon>{{ labels.copyRel }}
        </button>
        <button type="button" class="ctxitem" @click="copyPath(menu.target, 'abs')">
          <v-icon size="16">mdi-content-copy</v-icon>{{ labels.copyAbs }}
        </button>
        <button type="button" class="ctxitem" @click="menu.mode = 'pick'">
          <v-icon size="16">mdi-folder-move-outline</v-icon>移到分组
          <span class="more">›</span>
        </button>
      </template>
      <template v-else-if="menu.mode === 'pick'">
        <button type="button" class="ctxitem" @click="moveTo('')">
          <v-icon size="16">mdi-format-list-bulleted</v-icon>移出分组
        </button>
        <button
          v-for="g in groupChoices"
          :key="g.id"
          type="button"
          class="ctxitem"
          :style="{ paddingLeft: `${10 + g.depth * 12}px` }"
          @click="moveTo(g.id)"
        >
          <v-icon size="16">mdi-folder-outline</v-icon>{{ g.name }}
        </button>
        <button type="button" class="ctxitem" @click="newGroupAndMove">
          <v-icon size="16">mdi-folder-plus-outline</v-icon>新建分组并移入
        </button>
      </template>
      <template v-else-if="menu.mode === 'group'">
        <button type="button" class="ctxitem" @click="newSubGroup">
          <v-icon size="16">mdi-folder-plus-outline</v-icon>新建子分组
        </button>
        <button type="button" class="ctxitem" @click="startRename(menu.target)">
          <v-icon size="16">mdi-rename-box</v-icon>重命名
        </button>
        <button type="button" class="ctxitem" @click="askDeleteGroup">
          <v-icon size="16">mdi-trash-can-outline</v-icon>删除分组
        </button>
      </template>
      <template v-else>
        <button type="button" class="ctxitem" @click="newTopGroup">
          <v-icon size="16">mdi-folder-plus-outline</v-icon>新建分组
        </button>
      </template>
    </div>

    <FloatingDialog
      v-model="aliasOn"
      :initial-width="460"
      :initial-height="320"
      :min-width="360"
      :min-height="240"
    >
      <template #title>{{ labels.aliasTitle }}</template>
      <p class="tip">{{ aliasTarget ? aliasTarget.root : '' }}</p>
      <v-text-field
        v-model="aliasText"
        label="别名"
        density="compact"
        variant="outlined"
        maxlength="80"
        clearable
        autofocus
        @keyup.enter="saveAlias"
      />
      <p class="tip">{{ labels.aliasHint }}</p>
      <template #actions>
        <v-spacer />
        <v-btn variant="text" @click="aliasOn = false">取消</v-btn>
        <v-btn color="primary" variant="flat" :loading="aliasSaving" @click="saveAlias">
          保存
        </v-btn>
      </template>
    </FloatingDialog>

    <FloatingDialog
      v-model="renameOn"
      :initial-width="440"
      :initial-height="260"
      :min-width="340"
      :min-height="200"
    >
      <template #title>分组名称</template>
      <v-text-field
        v-model="renameText"
        label="名称"
        density="compact"
        variant="outlined"
        maxlength="80"
        autofocus
        @keyup.enter="saveRename"
      />
      <template #actions>
        <v-spacer />
        <v-btn variant="text" @click="renameOn = false">取消</v-btn>
        <v-btn color="primary" variant="flat" :disabled="!renameText.trim()" @click="saveRename">
          保存
        </v-btn>
      </template>
    </FloatingDialog>

    <FloatingDialog
      v-model="deleteOn"
      :initial-width="440"
      :initial-height="240"
      :min-width="340"
      :min-height="200"
    >
      <template #title>删除分组</template>
      {{ deleteTarget ? deleteTarget.name : '' }}
      <p class="tip">里面的子分组与工作区移到上一级，工作区本身不动。</p>
      <template #actions>
        <v-spacer />
        <v-btn variant="text" @click="deleteOn = false">取消</v-btn>
        <v-btn color="error" variant="flat" @click="doDeleteGroup">删除</v-btn>
      </template>
    </FloatingDialog>

    <FloatingDialog
      v-model="dialog"
      :initial-width="620"
      :initial-height="460"
      :min-width="420"
      :min-height="300"
    >
      <template #title>{{ labels.addTitle }}</template>
      <DirectoryPicker
        :key="dialogKey"
        v-model="path"
        :tip="labels.addTip"
        :label="labels.addLabel"
        :placeholder="labels.addPlaceholder"
        :loader="dirs"
        @update:valid="pathOk = $event"
      />
      <template #actions>
        <v-spacer />
        <v-btn variant="text" @click="dialog = false">取消</v-btn>
        <v-btn color="primary" variant="flat" :disabled="!path.trim() || !pathOk" @click="submit">
          {{ labels.addConfirm }}
        </v-btn>
      </template>
    </FloatingDialog>

    <FloatingDialog
      v-model="asking"
      :initial-width="440"
      :initial-height="260"
      :min-width="340"
      :min-height="200"
    >
      <template #title>{{ labels.removeTitle }}</template>
      {{ asking ? asking.root : '' }}
      <p class="tip">{{ labels.removeText }}</p>
      <template #actions>
        <v-spacer />
        <v-btn variant="text" @click="asking = null">取消</v-btn>
        <v-btn color="error" variant="flat" @click="drop">{{ labels.removeConfirm }}</v-btn>
      </template>
    </FloatingDialog>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import DirectoryPicker from './DirectoryPicker/index.js'
import FloatingDialog from './FloatingDialog.vue'
import { copyText } from '../utils/clipboard.js'
import {
  flattenRows,
  fullNodes as buildNodes,
  inSubtree as isInside,
  listGroups,
} from '../utils/workspaceLayout.js'

const props = defineProps({
  workspaces: { type: Array, required: true },
  current: { type: String, default: '' },
  busy: { type: Boolean, default: false },
  // 选目录与存别名的接口由调用方给，组件不认具体后端。
  dirs: { type: Function, required: true },
  saveAlias: { type: Function, required: true },
  texts: { type: Object, default: () => ({}) },
  // 左侧分组结构：一张平铺的节点表，同一父级下的先后按数组位置。
  groups: { type: Array, default: () => [] },
})

const DEFAULTS = {
  headTitle: '工作区',
  add: '添加',
  empty: '还没有工作区',
  forgetTitle: '移出工作区',
  menuAlias: '设置别名',
  copyRel: '复制相对路径',
  copyAbs: '复制绝对路径',
  aliasTitle: '设置别名',
  aliasHint: '留空表示不用别名，显示目录名。',
  aliasSaved: '别名已保存',
  aliasFailed: '保存别名失败：',
  copied: '已复制：',
  copyFailed: '复制失败，浏览器不允许访问剪贴板',
  addTitle: '添加工作区',
  addTip: '选工程所在的目录。',
  addLabel: '工程目录',
  addPlaceholder: '~/pros/项目名',
  addConfirm: '添加此目录',
  removeTitle: '移出工作区',
  removeText: '只是从列表里移出，工程目录本身不动。',
  removeConfirm: '移出',
}
const labels = computed(() => ({ ...DEFAULTS, ...props.texts }))

const emit = defineEmits(['select', 'add', 'remove', 'changed', 'notice', 'groups-change'])

// 分组结构只决定左侧怎么摆，服务端登记的工作区列表与默认选中都不动。
const collapsedIds = ref(new Set())
const dragItem = ref(null)
const dropTarget = ref(null)

const groupCount = computed(() => props.groups.filter((n) => n && n.kind === 'group').length)

const rows = computed(() => flattenRows(props.groups, props.workspaces, collapsedIds.value))
const groupChoices = computed(() => listGroups(props.groups))

// 改结构之前先补成一张完整的表：没登记的工作区补到最外层，已经移出的丢掉。
function fullNodes() {
  return buildNodes(props.groups, props.workspaces)
}

function inSubtree(rootId, groupId) {
  return isInside(props.groups, rootId, groupId)
}

function commit(nodes) {
  emit('groups-change', nodes)
}

function setParent(nodes, kind, id, parent) {
  const hit = nodes.find((node) => node.kind === kind && node.id === id)
  if (hit) hit.parent = parent
  else nodes.push({ kind, id, parent })
}

function newGroupId() {
  return `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

function rowClick(row) {
  if (row.kind !== 'group') {
    emit('select', row.id)
    return
  }
  const next = new Set(collapsedIds.value)
  if (next.has(row.id)) next.delete(row.id)
  else next.add(row.id)
  collapsedIds.value = next
}

function expandGroup(id) {
  if (!collapsedIds.value.has(id)) return
  const next = new Set(collapsedIds.value)
  next.delete(id)
  collapsedIds.value = next
}

function rowClass(row) {
  const item = dragItem.value
  const target = dropTarget.value
  const here = (mode) => !!target && target.mode === mode && target.kind === row.kind && target.id === row.id
  return {
    'drag-src': !!item && item.kind === row.kind && item.id === row.id,
    'drop-before': here('before'),
    'drop-after': here('after'),
    'drop-into': here('into'),
  }
}

// 拖动：工作区与分组都能拖；落在分组中间一半就放进这个分组。
function dragStart(event, row) {
  dragItem.value = { kind: row.kind, id: row.id }
  dropTarget.value = null
  // 不设数据，Firefox 不起拖。
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', row.id)
  }
}

function dragOver(event, row) {
  if (!dragItem.value) return
  const item = dragItem.value
  if (item.kind === row.kind && item.id === row.id) {
    dropTarget.value = null
    return
  }
  const box = event.currentTarget.getBoundingClientRect()
  const y = event.clientY - box.top
  let mode = y > box.height / 2 ? 'after' : 'before'
  if (row.kind === 'group') {
    if (y < box.height * 0.25) mode = 'before'
    else if (y > box.height * 0.75) mode = 'after'
    else mode = 'into'
  }
  // 分组不能拖进自己或自己的子孙，否则层级里会绕成环。
  if (item.kind === 'group' && inSubtree(item.id, mode === 'into' ? row.id : row.parent)) {
    dropTarget.value = null
    return
  }
  dropTarget.value = { kind: row.kind, id: row.id, mode }
}

function dropRow() {
  const item = dragItem.value
  const target = dropTarget.value
  if (!item || !target) return dragEnd()
  const nodes = fullNodes()
  const from = nodes.findIndex((node) => node.kind === item.kind && node.id === item.id)
  if (from < 0) return dragEnd()
  const moving = nodes.splice(from, 1)[0]
  if (target.mode === 'into') {
    moving.parent = target.id
    nodes.push(moving)
    expandGroup(target.id)
  } else {
    const at = nodes.findIndex((node) => node.kind === target.kind && node.id === target.id)
    if (at < 0) {
      moving.parent = ''
      nodes.push(moving)
    } else {
      moving.parent = nodes[at].parent || ''
      nodes.splice(target.mode === 'before' ? at : at + 1, 0, moving)
    }
  }
  commit(nodes)
  dragEnd()
}

function dragEnd() {
  dragItem.value = null
  dropTarget.value = null
}

const dialog = ref(false)
const path = ref('')
const pathOk = ref(false)
// 每次打开换一个 key，目录树重新从家目录拉，不带着上次展开的状态。
const dialogKey = ref(0)
const asking = ref(null)

// mode: ws 工作区菜单、pick 选分组、group 分组菜单、blank 空白处菜单。
const menu = reactive({ open: false, x: 0, y: 0, mode: 'blank', target: null })
const aliasOn = ref(false)
const aliasTarget = ref(null)
const aliasText = ref('')
const aliasSaving = ref(false)

const renameOn = ref(false)
const renameTarget = ref(null)
const renameText = ref('')
const deleteOn = ref(false)
const deleteTarget = ref(null)

function placeMenu(event) {
  // 靠近右边缘或下边缘时往回收，菜单不至于跑出窗口。
  menu.x = Math.max(8, Math.min(event.clientX, window.innerWidth - 210))
  menu.y = Math.max(8, Math.min(event.clientY, window.innerHeight - 160))
}

function rowMenu(event, row) {
  placeMenu(event)
  menu.mode = row.kind === 'group' ? 'group' : 'ws'
  menu.target = row.kind === 'group' ? row.group : row.ws
  menu.open = true
}

// 列表留白处右键：只管新建一级分组，标题栏那一行不算。
function blankMenu(event) {
  if (event.target.closest && event.target.closest('.head')) return
  placeMenu(event)
  menu.mode = 'blank'
  menu.target = null
  menu.open = true
}

function closeMenu() {
  menu.open = false
}

function startRename(group) {
  renameTarget.value = { id: group.id }
  renameText.value = group.name || ''
  renameOn.value = true
  closeMenu()
}

function saveRename() {
  const name = (renameText.value || '').trim().slice(0, 80)
  if (!name || !renameTarget.value) return
  const nodes = fullNodes().map((node) =>
    node.kind === 'group' && node.id === renameTarget.value.id ? { ...node, name } : node
  )
  commit(nodes)
  renameOn.value = false
}

function newTopGroup() {
  const nodes = fullNodes()
  const group = { kind: 'group', id: newGroupId(), name: '新分组', parent: '' }
  nodes.push(group)
  commit(nodes)
  closeMenu()
  startRename(group)
}

function newSubGroup() {
  const parent = menu.target
  if (!parent) return
  const nodes = fullNodes()
  const group = { kind: 'group', id: newGroupId(), name: '新分组', parent: parent.id }
  nodes.push(group)
  commit(nodes)
  expandGroup(parent.id)
  closeMenu()
  startRename(group)
}

function newGroupAndMove() {
  const ws = menu.target
  if (!ws) return
  const nodes = fullNodes()
  const group = { kind: 'group', id: newGroupId(), name: '新分组', parent: '' }
  nodes.push(group)
  setParent(nodes, 'ws', ws.id, group.id)
  commit(nodes)
  closeMenu()
  startRename(group)
}

function moveTo(parent) {
  if (!menu.target) return
  const nodes = fullNodes()
  setParent(nodes, 'ws', menu.target.id, parent)
  commit(nodes)
  if (parent) expandGroup(parent)
  closeMenu()
}

function askDeleteGroup() {
  deleteTarget.value = menu.target
  deleteOn.value = true
  closeMenu()
}

// 删分组不连坐：里面的子分组与工作区上提到被删分组原来的位置。
function doDeleteGroup() {
  const id = deleteTarget.value ? deleteTarget.value.id : ''
  if (id) {
    const nodes = fullNodes()
    const at = nodes.findIndex((node) => node.kind === 'group' && node.id === id)
    if (at >= 0) {
      const parent = nodes[at].parent || ''
      nodes.splice(at, 1)
      for (const node of nodes) {
        if ((node.parent || '') === id) node.parent = parent
      }
      commit(nodes)
    }
  }
  deleteOn.value = false
}

function startAlias(ws) {
  aliasTarget.value = ws
  aliasText.value = ws.alias || ''
  aliasOn.value = true
  closeMenu()
}

async function saveAlias() {
  if (!aliasTarget.value) return
  aliasSaving.value = true
  try {
    await props.saveAlias(aliasTarget.value.id, (aliasText.value || '').trim())
    aliasOn.value = false
    emit('changed')
    emit('notice', { text: labels.value.aliasSaved, color: 'primary' })
  } catch (err) {
    emit('notice', { text: `${labels.value.aliasFailed}${err.message}`, color: 'error' })
  } finally {
    aliasSaving.value = false
  }
}

async function copyPath(ws, kind) {
  const text = kind === 'rel' ? ws.rel || ws.root : ws.root
  const ok = await copyText(text)
  emit('notice', {
    text: ok ? `${labels.value.copied}${text}` : labels.value.copyFailed,
    color: ok ? 'primary' : 'error',
  })
  closeMenu()
}

onMounted(() => {
  document.addEventListener('click', closeMenu)
  document.addEventListener('contextmenu', closeMenu)
  window.addEventListener('resize', closeMenu)
  window.addEventListener('blur', closeMenu)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', closeMenu)
  document.removeEventListener('contextmenu', closeMenu)
  window.removeEventListener('resize', closeMenu)
  window.removeEventListener('blur', closeMenu)
})

function baseName(full) {
  const parts = String(full || '').split('/').filter(Boolean)
  return parts.length ? parts[parts.length - 1] : full
}

function openDialog() {
  path.value = ''
  pathOk.value = false
  dialogKey.value += 1
  dialog.value = true
}

function submit() {
  const value = path.value.trim()
  if (!value) return
  dialog.value = false
  emit('add', value)
}

function confirm(ws) {
  asking.value = ws
}

function drop() {
  const ws = asking.value
  asking.value = null
  if (ws) emit('remove', ws.id)
}
</script>

<style scoped>
.list {
  /* 撑满侧栏，列表下方那片留白也算列表的一部分，右键才接得住。 */
  min-height: 100%;
  padding: 8px 4px 16px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 12px;
}
.head-title {
  font-size: 0.82rem;
  letter-spacing: 0.06em;
  color: rgb(var(--v-theme-on-surface-variant));
}
.none {
  padding: 12px 16px;
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.9rem;
}
.items :deep(.v-list-item) {
  border-radius: 8px;
}
/* 拖着的这一行淡下去，插入位置在目标行的上沿画一条线。 */
.items :deep(.drag-src) {
  opacity: 0.45;
}
.items :deep(.drop-before) {
  box-shadow: inset 0 2px 0 rgb(var(--v-theme-primary));
}
.items :deep(.drop-after) {
  box-shadow: inset 0 -2px 0 rgb(var(--v-theme-primary));
}
/* 拖到分组中间：整行高亮，表示放进这个分组。 */
.items :deep(.drop-into) {
  background: rgba(var(--v-theme-primary), 0.14);
}
.gname {
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface-variant));
}
.gtext {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 名字太长时只把名字截掉，右边的标签与图标始终露出来。 */
.name {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-weight: 500;
}
.nm {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.path {
  font-size: 0.74rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.forget {
  opacity: 0;
  transition: opacity 0.15s;
}
.items :deep(.v-list-item:hover) .forget {
  opacity: 1;
}
.tip {
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.86rem;
  margin: 0 0 12px;
}
.ctxmenu {
  position: fixed;
  z-index: 3000;
  min-width: 180px;
  max-height: 60vh;
  overflow-y: auto;
  padding: 4px;
  border-radius: 8px;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-theme-on-surface), 0.16);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.24);
}
.ctxitem {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  font-size: 0.84rem;
  text-align: left;
  cursor: pointer;
}
.ctxitem:hover {
  background: rgba(var(--v-theme-on-surface), 0.08);
}
.ctxitem .more {
  margin-left: auto;
  padding-left: 12px;
  color: rgb(var(--v-theme-on-surface-variant));
}
</style>
