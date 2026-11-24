<!--
 * @Author: Himmeltala
 * @Date: 2026-11-12 15:44:39
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 22:55:31
 * @FilePath: \idex\web\src\features\changes\components\ChangesPanel.vue
 * @Description: 列出工作副本的未提交变更，按文件查看差异并直接编辑保存。
-->
<template>
  <div class="panel">
    <SyncBar
      :ws="ws"
      :files="files"
      :staged="stagedFiles"
      :refresh="refresh"
      @done="load"
    />

    <div ref="splitRef" class="split" :class="{ resizing }">
      <aside class="files" :style="{ '--list-width': `${listWidth}px` }">
        <div class="list-head">
          <v-spacer />
          <v-btn-toggle
            v-model="mode"
            variant="text"
            divided
            mandatory
            class="modes"
          >
            <v-btn value="flat" size="x-small" icon="mdi-view-list-outline" title="平铺列表" />
            <v-btn value="tree" size="x-small" icon="mdi-file-tree-outline" title="目录树" />
          </v-btn-toggle>
        </div>
        <p v-if="!loading && !files.length" class="none">工作副本是干净的，没有未提交的变更。</p>
        <div v-for="group in shownGroups" :key="group.key" class="group">
          <div class="group-head">
            <span class="group-title">{{ group.title }}</span>
            <span class="count">{{ groupList(group.key).length }}</span>
            <v-spacer />
            <v-btn
              v-if="group.action"
              size="x-small"
              variant="text"
              :prepend-icon="group.icon"
              :loading="acting === groupKey(group.key)"
              :disabled="!groupList(group.key).length"
              @click="actGroup(group)"
            >
              {{ group.action }}
            </v-btn>
          </div>
          <ul>
            <li
              v-for="row in rowsOf(group.key)"
              :key="row.kind + ':' + row.path"
              class="item"
              :class="{
                active:
                  row.kind === 'file' &&
                  selected &&
                  selected.group === group.key &&
                  selected.path === row.path,
              }"
              :style="{ paddingLeft: 8 + row.depth * 16 + 'px' }"
              :title="row.kind === 'dir' ? row.path : null"
              @click="
                row.kind === 'dir' ? toggleDir(group.key, row.path) : pick(row.file, group.key)
              "
            >
              <template v-if="row.kind === 'dir'">
                <v-icon size="16" class="chev">
                  {{ collapsedOf(group.key, row.path) ? 'mdi-chevron-right' : 'mdi-chevron-down' }}
                </v-icon>
                <v-icon size="16" class="dir-icon">
                  {{ collapsedOf(group.key, row.path) ? 'mdi-folder-outline' : 'mdi-folder-open-outline' }}
                </v-icon>
                <span class="dir-name" :title="row.path">{{ row.name }}</span>
                <span class="dir-count">{{ row.count }}</span>
              </template>
              <template v-else>
                <span class="letter" :style="{ color: tone(row.file) }">
                  {{ statusOf(row.file.item).letter }}
                </span>
                <v-icon
                  size="16"
                  class="ficon"
                  :style="iconOf(row.file).color ? { color: iconOf(row.file).color } : null"
                >
                  {{ iconOf(row.file).icon }}
                </v-icon>
                <div class="names">
                  <div class="name mono" :title="row.path">{{ row.name }}</div>
                  <div v-if="mode === 'flat' && dirName(row.path)" class="dir mono" :title="row.path">
                    {{ dirName(row.path) }}
                  </div>
                </div>
                <v-icon
                  v-if="marked(group.key, row.path)"
                  size="14"
                  class="held"
                  title="默认不渲染，点开才加载差异"
                >
                  mdi-eye-off-outline
                </v-icon>
                <span class="state">{{ statusOf(row.file.item).text }}</span>
                <v-btn
                  v-if="rowAction(group.key, row.file)"
                  size="x-small"
                  variant="text"
                  class="row-action"
                  :title="rowAction(group.key, row.file).title"
                  :loading="acting === rowKey(group.key, row.file)"
                  @click.stop="actRow(group.key, row.file)"
                >
                  <v-icon size="16">{{ rowAction(group.key, row.file).icon }}</v-icon>
                </v-btn>
              </template>
            </li>
          </ul>
        </div>
      </aside>

      <SplitHandle axis="x" :active="resizing" @start="startSplit" @reset="resetSplit" />

      <section class="view">
        <EmptyState
          v-if="awaitingLoad"
          icon="mdi-file-hidden"
          :icon-size="28"
          :path="selected.path"
          hint="这是锁文件、构建产物，或单行超过 2000 字符的文件，默认不加载差异。"
          action="加载差异"
          action-icon="mdi-eye-outline"
          @action="showDeferred"
        />
        <DiffView
          v-else
          ref="diffRef"
          :title="diffTitle"
          :path="selected ? selected.path : ''"
          :text="content.text"
          :kind="content.kind"
          :truncated="content.truncated"
          :loading="diffLoading"
          :error="diffError"
          :editable="diffEditable"
          :base-text="editState.baseText"
          :read-only-reason="readOnlyReason"
          @dirty="onDirty"
        >
          <template #actions>
            <v-btn-toggle
              v-model="diffScope"
              density="compact"
              variant="text"
              divided
              mandatory
              class="scopes"
            >
              <v-btn value="hunks" size="small" title="只显示改动的片段">仅改动</v-btn>
              <v-btn value="file" size="small" title="显示整份文件，改动的行照样标出来">整份文件</v-btn>
            </v-btn-toggle>
            <template v-if="dirty">
              <v-chip size="x-small" variant="flat" color="modified">未保存</v-chip>
              <v-btn size="small" variant="text" color="primary" :loading="saving" @click="saveNow">
                保存
              </v-btn>
              <v-btn size="small" variant="text" :disabled="saving" @click="discard">放弃</v-btn>
            </template>
          </template>
        </DiffView>
      </section>
    </div>

    <FloatingDialog
      v-model="asking"
      :initial-width="420"
      :initial-height="260"
      :min-width="340"
      :min-height="200"
      persistent
    >
      <template #title>还没保存</template>
      当前文件在差异里改过，还没写回工作副本。
      <template #actions>
        <v-btn variant="text" @click="answerLeave('cancel')">取消</v-btn>
        <v-spacer />
        <v-btn variant="text" color="error" @click="answerLeave('drop')">放弃改动</v-btn>
        <v-btn variant="flat" color="primary" :loading="saving" @click="answerLeave('save')">
          保存
        </v-btn>
      </template>
    </FloatingDialog>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import DiffView from '@bash-scripts/web-shared/diff'
import { EmptyState } from '@bash-scripts/web-shared/layouts'
import { api } from '../../../utils/api'
import { SplitHandle } from '@bash-scripts/web-shared/layouts'
import { FloatingDialog } from '@bash-scripts/web-shared/feedbacks'
import { fileIcon } from '@bash-scripts/web-shared'
import { baseName, dirName, statusOf } from '../../../utils/format'
import { groupsFor, keyOf, rowActionOf, scopeOf } from '../lib/changesView'
import SyncBar from '../../sync/components/SyncBar.vue'
import { useLeaveGuard } from '../composables/useLeaveGuard'
import { isDeferred } from '../../../utils/deferred'
import { toast } from '../../../utils/notice'
import { usePreferencesStore } from '../../../stores/preferences'
import { useFileTree } from '@bash-scripts/web-shared'
import { useSplitPane } from '@bash-scripts/web-shared'

const props = defineProps({
  ws: { type: Object, required: true },
  refresh: { type: Number, default: 0 },
})
const emit = defineEmits(['loaded'])

const files = ref([])
// Git 的索引、工作区与冲突三组；SVN 没有索引，只有 files 一份。
const status = ref(null)
const truncated = ref(false)
const selected = ref(null)
const acting = ref('')
const content = ref({ text: '', kind: 'diff', truncated: false })
const loading = ref(false)
const diffLoading = ref(false)
const error = ref('')
const diffError = ref('')
const diffRef = ref(null)
// 差异行里直接改：工作副本快照给行内容与写回位置，读不出来就只能看。
const editState = ref({ editable: false, baseText: '', reason: '' })
const dirty = ref(false)
const saving = ref(false)
const saveError = ref('')
let pendingRefresh = false
let pickSeq = 0
let revertingScope = false

watch(error, (text) => {
  if (text) toast(text, 'error')
})
watch(saveError, (text) => {
  if (text) toast(text, 'error')
})

// 查看方式来自全局偏好，所有工作区共用；树形默认全部展开。
const preferences = usePreferencesStore()
const { changesMode: mode, diffScope } = storeToRefs(preferences)
// 左侧列表的宽度随分隔条拖动改变，双击分隔条还原。
const splitRef = ref(null)
const { size: listWidth, resizing, start: startSplit, reset: resetSplit } = useSplitPane({
  area: splitRef,
  initial: 320,
  min: 200,
  rightMin: 280,
  persist: 'idex.changes.list-width',
})

const isGit = computed(() => props.ws.vcs === 'git')
// 未保存改动的离店询问：保存与丢弃的动作留在页面，询问本身交给组合式函数。
const {
  asking,
  confirmLeave,
  answer: answerLeave,
  cancel: cancelLeave,
} = useLeaveGuard({
  isDirty: () => dirty.value,
  save: () => saveNow(),
  drop: () => discard(),
})
const diffTitle = computed(() => (selected.value ? selected.value.path : ''))
// 锁文件、构建产物与单行过长的文件不自动取差异；点过“加载差异”的文件记在这里，换回来不再拦。
// 键带上差异口径：同一个文件在已暂存与更改里是两份内容。
const revealed = ref(new Set())
const widePaths = ref(new Set())
const marked = (group, path) => isDeferred(path) || widePaths.value.has(keyOf(group, path))
const awaitingLoad = computed(() => {
  if (!selected.value) return false
  const { group, path } = selected.value
  return marked(group, path) && !revealed.value.has(keyOf(group, path))
})
const diffEditable = computed(
  () => editState.value.editable && !content.value.truncated && !diffLoading.value,
)

const readOnlyReason = computed(() => {
  if (!selected.value || diffLoading.value || diffError.value || !content.value.text) return ''
  if (selected.value.group === 'staged') return '已暂存的内容只看不改；要改改工作区那份'
  if (content.value.truncated) return '差异已截断，不能直接在差异里编辑'
  return editState.value.reason
})

function tone(file) {
  return `rgb(var(--v-theme-${statusOf(file.item).color}))`
}

// 与资源管理器共用同一套文件类型图标。
function iconOf(file) {
  return fileIcon(file.path)
}

const groups = computed(() => groupsFor(isGit.value))

function groupList(key) {
  if (!isGit.value) return files.value
  return (status.value && status.value[key]) || []
}

const shownGroups = computed(() => groups.value.filter((group) => groupList(group.key).length))
// 提交条只关心已暂存列表；SVN 没有索引，按工作区文件展示。
const stagedFiles = computed(() => (isGit.value ? groupList('staged') : []))

// 每组一棵树，收起状态互不影响；SVN 只有“更改”组，复用这棵。
const trees = {
  staged: useFileTree(() => groupList('staged')),
  unstaged: useFileTree(() => groupList('unstaged')),
  conflicts: useFileTree(() => groupList('conflicts')),
}

function rowsOf(key) {
  const list = groupList(key)
  if (mode.value !== 'tree') {
    return list.map((file) => ({
      kind: 'file',
      name: baseName(file.path),
      path: file.path,
      depth: 0,
      file,
    }))
  }
  return trees[key].rows.value
}

function collapsedOf(key, path) {
  return !!trees[key].collapsed[path]
}

function toggleDir(key, path) {
  trees[key].toggle(path)
}

// 行内动作按工作副本类型与所在组选，规则在 changesView 里。
function rowAction(key, file) {
  return rowActionOf(key, file, isGit.value)
}

const groupKey = (key) => `group:${key}`
const rowKey = (key, file) => `${key}:${file.path}`

async function actGroup(group) {
  const paths = groupList(group.key).map((file) => file.path)
  if (!paths.length) return
  const call = group.key === 'staged' ? api.unstage : api.stage
  await runAction(groupKey(group.key), () => call(props.ws.id, paths))
}

// 行上的按钮各走各的接口：Git 分暂存与取消，SVN 分纳入与撤回纳入。
function rowCall(key, file) {
  if (!isGit.value) return file.item === 'added' ? api.svnUnadd : api.svnAdd
  return key === 'staged' ? api.unstage : api.stage
}

async function actRow(key, file) {
  const call = rowCall(key, file)
  await runAction(rowKey(key, file), () => call(props.ws.id, [file.path]))
}

// 写接口返回的就是变更清单，直接换掉页面上的这份，不再多取一遍。
// 动作会改索引、还可能换掉选中项，先处理完没保存的改动再动。
async function runAction(key, task) {
  if (acting.value) return
  if (!(await confirmLeave())) return
  acting.value = key
  error.value = ''
  try {
    await apply(await task())
  } catch (err) {
    error.value = err.message
  } finally {
    acting.value = ''
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    await apply(await api.changes(props.ws.id))
  } catch (err) {
    error.value = err.message
    emit('loaded', 0)
  } finally {
    loading.value = false
  }
}

function findIn(group, path) {
  const file = groupList(group).find((item) => item.path === path)
  return file ? { group, file } : null
}

function findAnywhere(path) {
  for (const group of groups.value) {
    const hit = findIn(group.key, path)
    if (hit) return hit
  }
  return null
}

function firstEntry() {
  for (const group of groups.value) {
    const file = groupList(group.key)[0]
    if (file) return { group: group.key, file }
  }
  return null
}

async function apply(data) {
  files.value = data.files || []
  status.value = data.status || null
  truncated.value = !!data.truncated
  emit('loaded', files.value.length)
  // 选中的文件还在原组就留着；换组了（暂存、取消暂存）按路径跟过去，都没有就退回第一项。
  const prev = selected.value
  const keep = prev && findIn(prev.group, prev.path)
  if (keep) {
    selected.value = { group: keep.group, path: keep.file.path, file: keep.file }
    // SVN 纳入或撤回纳入不换组，但状态变了，差异口径跟着变，得重新取一次。
    if (keep.file.item !== prev.file.item) {
      await pick(keep.file, keep.group, { skipGuard: true })
    }
    return
  }
  const next = (prev && findAnywhere(prev.path)) || firstEntry()
  if (next) {
    // 交给 pick 换选中项；它问完未保存的改动之前，不能先清掉正在编辑的内容。
    await pick(next.file, next.group)
    return
  }
  selected.value = null
  content.value = { text: '', kind: 'diff', truncated: false }
}

// 读一份工作副本快照：改的是这份内容，写回也按它的行号定位。
async function snapshotOf(file) {
  if (file.item === 'deleted' || file.item === 'missing') {
    return { editable: false, baseText: '', reason: '文件已删除，没有可改的内容' }
  }
  try {
    const data = await api.file(props.ws.id, file.path)
    return { editable: true, baseText: (data.text || '').replace(/\r\n?/g, '\n'), reason: '' }
  } catch (err) {
    return { editable: false, baseText: '', reason: err.message }
  }
}

async function pick(file, group, { skipGuard = false } = {}) {
  if (!skipGuard && !(await confirmLeave())) return
  const mine = ++pickSeq
  const key = keyOf(group, file.path)
  selected.value = { group, path: file.path, file }
  diffError.value = ''
  saveError.value = ''
  editState.value = { editable: false, baseText: '', reason: '' }
  if (marked(group, file.path) && !revealed.value.has(key)) {
    // 连工作副本快照都不取：大文件只在用户点了“加载差异”之后才读。
    content.value = { text: '', kind: 'diff', truncated: false }
    diffLoading.value = false
    return
  }
  diffLoading.value = true
  try {
    // 已暂存的内容只读，不用为编辑读工作副本快照。
    const [data, snap] = await Promise.all([
      api.diff(props.ws.id, file.path, file.item, diffScope.value === 'file', scopeOf(group)),
      group === 'staged' ? null : snapshotOf(file),
    ])
    if (mine !== pickSeq) return
    if (data.wide && !revealed.value.has(key)) {
      // 单行太长：差异已经取到也不渲染，先记下路径，换回来直接走占位。
      widePaths.value.add(key)
      content.value = { text: '', kind: 'diff', truncated: false }
      return
    }
    content.value = data
    if (group === 'staged') {
      editState.value = { editable: false, baseText: '', reason: '' }
    } else {
      editState.value = data.truncated
        ? { editable: false, baseText: snap.baseText, reason: '差异已截断，不能直接在差异里编辑' }
        : snap
    }
  } catch (err) {
    if (mine !== pickSeq) return
    content.value = { text: '', kind: 'diff', truncated: false }
    diffError.value = err.message
  } finally {
    if (mine === pickSeq) diffLoading.value = false
  }
}

// 用户在右侧点了“加载差异”：记住这个文件，再走正常的取差异流程。
function showDeferred() {
  if (!selected.value) return
  revealed.value.add(keyOf(selected.value.group, selected.value.path))
  pick(selected.value.file, selected.value.group, { skipGuard: true })
}

function onDirty(value) {
  dirty.value = value
  if (value || !pendingRefresh) return
  pendingRefresh = false
  load()
}

function discard() {
  pendingRefresh = false
  saveError.value = ''
  diffRef.value?.resetEdits()
  dirty.value = false
}

// 只写回工作副本；先重读一遍，和进入编辑时的快照对不上就不写，免得盖掉别人的改动。
async function persist() {
  if (!dirty.value || !selected.value || !diffRef.value || saving.value) return false
  saving.value = true
  saveError.value = ''
  try {
    const snap = await api.file(props.ws.id, selected.value.path)
    const disk = (snap.text || '').replace(/\r\n?/g, '\n')
    if (disk !== editState.value.baseText) {
      throw new Error('文件在编辑期间被改过，先刷新再改')
    }
    await api.save(props.ws.id, selected.value.path, diffRef.value.collect())
    pendingRefresh = false
    diffRef.value.resetEdits()
    dirty.value = false
    return true
  } catch (err) {
    saveError.value = err.message
    return false
  } finally {
    saving.value = false
  }
}

async function saveNow() {
  if (!(await persist())) return false
  await load()
  if (selected.value) {
    await pick(selected.value.file, selected.value.group, { skipGuard: true })
  }
  return true
}


function onKeySave(event) {
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return
  if (!dirty.value || saving.value) return
  event.preventDefault()
  saveNow()
}

// 切换差异口径时按当前文件重新取一遍；取消就把开关拨回去。
watch(diffScope, async (now, before) => {
  if (revertingScope) {
    revertingScope = false
    return
  }
  if (!selected.value) return
  const outcome = await confirmLeave()
  if (!outcome) {
    revertingScope = true
    diffScope.value = before
    return
  }
  if (selected.value) {
    await pick(selected.value.file, selected.value.group, { skipGuard: true })
  }
})
watch(() => props.ws.id, load)
// 外部变化（含刚保存的那次）不打断正在改的内容，等改完再刷新。
watch(() => props.refresh, () => {
  if (saving.value) return
  if (dirty.value) {
    pendingRefresh = true
    return
  }
  load()
})
onMounted(() => {
  document.addEventListener('keydown', onKeySave)
  load()
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeySave)
  cancelLeave()
})

defineExpose({ load })
</script>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}
.count {
  font-size: 0.75rem;
  color: rgb(var(--v-theme-on-surface-variant));
  white-space: nowrap;
}
.split {
  flex: 1 1 auto;
  display: flex;
  min-height: 0;
}
.split.resizing {
  cursor: col-resize;
  user-select: none;
}
.files {
  width: var(--list-width, 320px);
  flex: 0 0 var(--list-width, 320px);
  overflow: auto;
  scrollbar-gutter: stable;
}
.files ul {
  list-style: none;
  margin: 0;
  padding: 4px;
}
.group + .group {
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
.list-head {
  display: flex;
  align-items: center;
  padding: 2px 8px 4px;
}
.group-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px 2px;
}
/* 分组右侧的小按钮：图标跟着小号文字缩，别用默认 24px，否则图标与文字不在一条线上。 */
.group-head :deep(.v-btn__prepend .v-icon) {
  font-size: 16px;
  width: 16px;
  height: 16px;
}
.group-head :deep(.v-btn__prepend) {
  margin-inline-end: 2px;
}
.group-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
}
.item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border-radius: 6px;
  cursor: pointer;
  min-height: 30px;
}
.item:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
}
.item.active {
  background: rgba(var(--v-theme-primary), 0.14);
}
.row-action {
  flex: 0 0 auto;
  min-width: 26px;
  padding: 0 4px;
  opacity: 0;
}
.item:hover .row-action,
.item.active .row-action,
.row-action:focus-visible {
  opacity: 1;
}
.chev {
  flex: 0 0 16px;
  color: rgb(var(--v-theme-on-surface-variant));
}
.dir-icon {
  flex: 0 0 auto;
  color: rgb(var(--v-theme-primary));
}
.dir-name {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dir-count {
  flex: 0 0 auto;
  min-width: 18px;
  padding: 0 5px;
  border-radius: 9px;
  text-align: center;
  font-size: 0.68rem;
  color: rgb(var(--v-theme-on-surface-variant));
  background: rgba(var(--v-theme-on-surface), 0.08);
}
.letter {
  flex: 0 0 16px;
  text-align: center;
  font-weight: 600;
  font-size: 0.8rem;
}
.ficon {
  flex: 0 0 auto;
  color: rgb(var(--v-theme-on-surface-variant));
}
.names {
  flex: 1 1 auto;
  min-width: 0;
}
.name {
  font-size: 0.8rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dir {
  font-size: 0.72rem;
  color: rgb(var(--v-theme-on-surface-variant));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.state {
  flex: 0 0 auto;
  font-size: 0.7rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.held {
  flex: 0 0 auto;
  color: rgb(var(--v-theme-on-surface-variant));
}
.view {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.none {
  padding: 12px 16px;
  font-size: 0.86rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.hint {
  margin: 8px 12px;
  font-size: 0.82rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.hint.bad {
  color: rgb(var(--v-theme-error));
}
</style>
