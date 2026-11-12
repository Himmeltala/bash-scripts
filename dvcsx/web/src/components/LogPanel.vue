<template>
  <div class="panel">
    <div class="bar">
      <span class="count">
        最近 {{ entries.length }} 次提交
        <template v-if="isGit && remote && remote.branch">
          · <span class="mono">{{ remote.branch }}</span>
          <span
            v-if="remote.ahead"
            class="ab"
            :title="`本地分支比 ${remote.upstream} 多 ${remote.ahead} 个提交`"
          >
            <v-icon size="12">mdi-arrow-up-bold</v-icon>{{ remote.ahead }}
          </span>
          <span
            v-if="remote.behind"
            class="ab"
            :title="`${remote.upstream} 比本地分支多 ${remote.behind} 个提交`"
          >
            <v-icon size="12">mdi-arrow-down-bold</v-icon>{{ remote.behind }}
          </span>
        </template>
        <template v-if="isGit && remote && remote.upstream">
          · <span class="mono">{{ remote.upstream }}</span>
          {{ remote.fetched ? '已同步' : '未同步' }}
        </template>
        <template v-if="!isGit && remote">
          · 工作副本 r{{ remote.wc_revision }}
          <template v-if="pendingCount">· {{ pendingCount }} 个版本待更新</template>
        </template>
      </span>
      <v-btn
        size="small"
        variant="text"
        color="primary"
        prepend-icon="mdi-refresh"
        :loading="loading"
        @click="load"
      >
        刷新
      </v-btn>
    </div>

    <p v-if="error" class="hint bad">{{ error }}</p>
    <p v-if="remote && remote.error" class="hint warn">
      远端没同步上：{{ remote.error }}，下面是上次同步到的记录。
    </p>

    <div class="split">
      <aside class="revs">
        <p v-if="!loading && !entries.length" class="none">还没有提交记录。</p>
        <div
          v-for="entry in entries"
          :key="entry.revision"
          class="revitem"
          :class="{
            active: current && current.revision === entry.revision,
            incoming: !entry.local,
          }"
          @click="select(entry)"
        >
          <div class="line1">
            <span class="rev mono">{{ revLabel(entry.revision) }}</span>
            <span class="author">{{ entry.author || '（无作者）' }}</span>
            <span class="date">{{ when(entry.date) }}</span>
          </div>
          <div class="msg">{{ firstLine(entry.message) }}</div>
          <div v-if="refsOf(entry).length || stateOf(entry)" class="refs">
            <span
              v-for="mark in refsOf(entry)"
              :key="mark.text"
              class="ref"
              :class="mark.kind"
              :title="mark.title"
            >
              <v-icon size="11">{{ mark.icon }}</v-icon>{{ mark.text }}
            </span>
            <span
              v-if="stateOf(entry)"
              class="ref"
              :class="stateOf(entry).kind"
              :title="stateOf(entry).title"
            >
              <v-icon size="11">{{ stateOf(entry).icon }}</v-icon>{{ stateOf(entry).text }}
            </span>
          </div>
        </div>
      </aside>

      <section class="detail">
        <template v-if="current">
          <div class="commit">
            <div class="commit-head">
              <span class="rev mono">{{ revLabel(current.revision) }}</span>
              <span
                v-for="mark in refsOf(current)"
                :key="mark.text"
                class="ref"
                :class="mark.kind"
                :title="mark.title"
              >
                <v-icon size="11">{{ mark.icon }}</v-icon>{{ mark.text }}
              </span>
              <span
                v-if="stateOf(current)"
                class="ref"
                :class="stateOf(current).kind"
                :title="stateOf(current).title"
              >
                <v-icon size="11">{{ stateOf(current).icon }}</v-icon>{{ stateOf(current).text }}
              </span>
              <span class="author">{{ current.author || '（无作者）' }}</span>
              <span class="date">{{ when(current.date) }}</span>
              <v-spacer />
              <v-btn size="x-small" variant="text" color="primary" @click="wholeCommit">
                整次提交的差异
              </v-btn>
            </div>
            <pre class="message">{{ current.message || '（没有写提交说明）' }}</pre>
          </div>

          <div
            ref="bodyRef"
            class="body"
            :class="{ dragging, 'diff-collapsed': diffCollapsed }"
          >
            <div class="pane files" :class="{ collapsed: filesCollapsed }" :style="filesStyle">
              <div class="pane-head">
                <span class="pane-title">改动的文件</span>
                <span class="pane-count">{{ current.paths.length }}</span>
                <v-spacer />
                <v-btn
                  icon
                  size="x-small"
                  variant="text"
                  :title="filesCollapsed ? '展开文件列表' : '收起文件列表'"
                  @click="toggleFiles"
                >
                  <v-icon size="18">
                    {{ filesCollapsed ? 'mdi-chevron-down' : 'mdi-chevron-up' }}
                  </v-icon>
                </v-btn>
              </div>
              <div v-show="!filesCollapsed" class="paths">
                <div
                  v-for="item in current.paths"
                  :key="item.path + item.action"
                  class="path"
                  :class="{ active: activePath === item.path }"
                  :title="item.path"
                  @click="openPath(item.path)"
                >
                  <span class="letter" :style="{ color: tone(item.action) }">{{ item.action }}</span>
                  <span class="mono name">{{ shortenPath(shortPath(item.path), 60) }}</span>
                </div>
                <p v-if="!current.paths.length" class="none">这次提交没有列出变更路径。</p>
              </div>
            </div>

            <div
              class="gutter"
              :class="{ disabled: filesCollapsed || diffCollapsed }"
              title="拖动调整两块区域的高度，双击还原"
              @pointerdown="startDrag"
              @dblclick="resetSplit"
            >
              <span class="grip" />
            </div>

            <div class="pane diffpane" :class="{ collapsed: diffCollapsed }">
              <DiffView
                v-if="!diffCollapsed"
                :title="diffTitle"
                :text="content.text"
                kind="diff"
                :truncated="content.truncated"
                :loading="diffLoading"
                :error="diffError"
              >
                <template #actions>
                  <v-btn icon size="x-small" variant="text" title="收起差异" @click="toggleDiff">
                    <v-icon size="18">mdi-chevron-down</v-icon>
                  </v-btn>
                </template>
              </DiffView>
              <div v-else class="pane-head">
                <span class="pane-title mono folded-title" :title="diffTitle">{{ diffTitle }}</span>
                <v-spacer />
                <v-btn icon size="x-small" variant="text" title="展开差异" @click="toggleDiff">
                  <v-icon size="18">mdi-chevron-up</v-icon>
                </v-btn>
              </div>
            </div>
          </div>
        </template>
        <div v-else class="none">选一次提交看详情。</div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import DiffView from './DiffView.vue'
import { api } from '../composables/useApi'
import { actionOf, firstLine, shortenPath, shortPath, when } from '../composables/format'

const props = defineProps({
  ws: { type: Object, required: true },
})

const entries = ref([])
const current = ref(null)
const remote = ref(null)
const activePath = ref('')
const content = ref({ text: '', truncated: false })
const loading = ref(false)
const diffLoading = ref(false)
const error = ref('')
const diffError = ref('')

const bodyRef = ref(null)
const filesCollapsed = ref(false)
const diffCollapsed = ref(false)
const dragging = ref(false)
// 文件列表占详情区的高度比例，拖动中间的分隔条改它。
const filePct = ref(35)
let startY = 0
let startPct = 0

const isGit = computed(() => props.ws.vcs === 'git')
// SVN 没有待推送这一说，只统计服务器上还没更新到工作副本的版本。
const pendingCount = computed(() => entries.value.filter((entry) => !entry.local).length)

// 引用标签照 VS Code 的做法只点在本分支与远端分支所在的提交上。
function refsOf(entry) {
  const refs = []
  if (!isGit.value) return refs
  if (entry.head) {
    refs.push({
      kind: 'head',
      icon: 'mdi-source-branch',
      text: (remote.value && remote.value.branch) || 'HEAD',
      title: '本地分支当前提交',
    })
  }
  if (entry.remote_tip && remote.value && remote.value.upstream) {
    refs.push({
      kind: 'upstream',
      icon: 'mdi-cloud-outline',
      text: remote.value.upstream,
      title: '远端跟踪分支的最新提交',
    })
  }
  return refs
}

// 提交相对本地分支与远端分支的位置；没有远端跟踪分支时不做判断。
function stateOf(entry) {
  if (!isGit.value) {
    if (entry.local) return null
    return {
      kind: 'pending',
      icon: 'mdi-cloud-download-outline',
      text: '待更新',
      title: '工作副本还没有这个版本',
    }
  }
  if (entry.pushed === undefined) return null
  if (!entry.local) {
    return {
      kind: 'pending',
      icon: 'mdi-cloud-download-outline',
      text: '待拉取',
      title: '这个提交还只在远端分支上',
    }
  }
  if (!entry.pushed) {
    return {
      kind: 'local',
      icon: 'mdi-cloud-upload-outline',
      text: '未推送',
      title: '这个提交还没进远端分支',
    }
  }
  return null
}

const filesStyle = computed(() =>
  filesCollapsed.value || diffCollapsed.value ? null : { flex: `0 0 ${filePct.value}%` },
)

// 两块都收起就什么都不剩了，所以收起一块时另一块自动展开。
function toggleFiles() {
  if (filesCollapsed.value) {
    filesCollapsed.value = false
    return
  }
  if (diffCollapsed.value) diffCollapsed.value = false
  filesCollapsed.value = true
}

function toggleDiff() {
  if (diffCollapsed.value) {
    diffCollapsed.value = false
    return
  }
  if (filesCollapsed.value) filesCollapsed.value = false
  diffCollapsed.value = true
}

function startDrag(event) {
  if (event.button !== 0 || filesCollapsed.value || diffCollapsed.value) return
  if (!bodyRef.value) return
  dragging.value = true
  startY = event.clientY
  startPct = filePct.value
  event.preventDefault()
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', endDrag, { once: true })
}

function onDragMove(event) {
  const height = bodyRef.value ? bodyRef.value.clientHeight : 0
  if (!height) return
  const next = startPct + ((event.clientY - startY) / height) * 100
  filePct.value = Math.min(Math.max(next, 15), 82)
}

function endDrag() {
  dragging.value = false
  window.removeEventListener('pointermove', onDragMove)
}

function resetSplit() {
  filePct.value = 35
}

onBeforeUnmount(endDrag)

// SVN 的版本号前面带 r，Git 给的是完整 sha，列表上只显示前 7 位。
function revLabel(rev) {
  return isGit.value ? String(rev).slice(0, 7) : `r${rev}`
}

const diffTitle = computed(() => {
  if (!current.value) return ''
  const rev = revLabel(current.value.revision)
  return activePath.value ? `${rev}  ${activePath.value}` : `${rev}  整次提交`
})

function tone(action) {
  return `rgb(var(--v-theme-${actionOf(action).color}))`
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await api.log(props.ws.id, 50)
    entries.value = data.entries || []
    remote.value = data.remote || null
    const hit = entries.value.find((e) => current.value && e.revision === current.value.revision)
    await select(hit || entries.value[0] || null)
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function select(entry) {
  current.value = entry
  activePath.value = ''
  content.value = { text: '', truncated: false }
  diffError.value = ''
  if (!entry) return
  // 提交里的文件常常好几个，默认打开第一个，省一次点击。
  if (entry.paths.length) await openPath(entry.paths[0].path)
}

async function openPath(path) {
  if (!current.value) return
  activePath.value = path
  await loadDiff(path)
}

async function wholeCommit() {
  activePath.value = ''
  await loadDiff('')
}

async function loadDiff(path) {
  diffLoading.value = true
  diffError.value = ''
  try {
    content.value = await api.revision(props.ws.id, current.value.revision, path)
  } catch (err) {
    content.value = { text: '', truncated: false }
    diffError.value = err.message
  } finally {
    diffLoading.value = false
  }
}

watch(() => props.ws.id, load)
onMounted(load)

defineExpose({ load })
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
.split {
  flex: 1 1 auto;
  display: flex;
  min-height: 0;
}
.revs {
  width: 320px;
  flex: 0 0 320px;
  overflow: auto;
  border-right: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}
.revitem {
  padding: 8px 10px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.07);
  cursor: pointer;
}
.revitem:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
}
.revitem.active {
  background: rgba(var(--v-theme-primary), 0.14);
}
/* 本地还没有的提交沿左边描一道，扫列表时能看出从哪条开始是远端的。 */
.revitem.incoming {
  box-shadow: inset 2px 0 0 rgb(var(--v-theme-modified));
}
.line1 {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.rev {
  font-size: 0.78rem;
  font-weight: 600;
  color: rgb(var(--v-theme-primary));
}
.ab {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  margin-left: 4px;
  color: rgb(var(--v-theme-on-surface-variant));
}
.refs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-top: 3px;
}
.ref {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 0 5px;
  border-radius: 6px;
  font-size: 0.66rem;
  line-height: 1.6;
  white-space: nowrap;
}
.ref.head {
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.12);
}
.ref.upstream {
  color: rgb(var(--v-theme-on-surface-variant));
  background: rgba(var(--v-theme-on-surface), 0.08);
}
.ref.pending {
  color: rgb(var(--v-theme-modified));
  background: rgba(var(--v-theme-modified), 0.12);
}
.ref.local {
  color: rgb(var(--v-theme-on-surface-variant));
  border: 1px solid rgba(var(--v-theme-on-surface), 0.22);
}
.author {
  font-size: 0.76rem;
  color: rgb(var(--v-theme-on-surface));
}
.date {
  font-size: 0.7rem;
  color: rgb(var(--v-theme-on-surface-variant));
  margin-left: auto;
  white-space: nowrap;
}
.msg {
  margin-top: 2px;
  font-size: 0.78rem;
  color: rgb(var(--v-theme-on-surface-variant));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.detail {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.commit {
  flex: 0 0 auto;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  max-height: 32%;
  overflow: auto;
}
.commit-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.message {
  margin: 8px 0;
  font-family: inherit;
  font-size: 0.84rem;
  white-space: pre-wrap;
  word-break: break-word;
}
.body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.body.dragging {
  cursor: row-resize;
  user-select: none;
}
.pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.files {
  flex: 0 0 35%;
}
.files.collapsed {
  flex: 0 0 auto;
}
.body.diff-collapsed .files {
  flex: 1 1 auto;
}
.pane-head {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  padding: 0 6px 0 12px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
.pane-title {
  font-size: 0.76rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.pane-count {
  padding: 0 6px;
  border-radius: 8px;
  font-size: 0.72rem;
  color: rgb(var(--v-theme-on-surface-variant));
  background: rgba(var(--v-theme-on-surface), 0.08);
}
.folded-title {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.paths {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: 4px 6px;
}
.gutter {
  flex: 0 0 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: row-resize;
  background: rgba(var(--v-theme-on-surface), 0.04);
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
.gutter .grip {
  width: 36px;
  height: 3px;
  border-radius: 2px;
  background: rgba(var(--v-theme-on-surface), 0.22);
}
.gutter:hover,
.body.dragging .gutter {
  background: rgba(var(--v-theme-primary), 0.12);
}
.gutter:hover .grip,
.body.dragging .gutter .grip {
  background: rgb(var(--v-theme-primary));
}
.gutter.disabled {
  cursor: default;
}
.gutter.disabled .grip {
  opacity: 0.45;
}
.diffpane {
  flex: 1 1 auto;
  min-height: 0;
}
.diffpane.collapsed {
  flex: 0 0 auto;
}
.path {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 6px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.78rem;
}
.path:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
}
.path.active {
  background: rgba(var(--v-theme-primary), 0.14);
}
.letter {
  flex: 0 0 14px;
  text-align: center;
  font-weight: 600;
}
.name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.none {
  padding: 12px 16px;
  font-size: 0.84rem;
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
.hint.warn {
  color: rgb(var(--v-theme-warning));
}
@media (max-width: 900px) {
  .split {
    flex-direction: column;
  }
  .revs {
    width: 100%;
    flex: 0 0 auto;
    max-height: 220px;
    border-right: none;
    border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  }
}
</style>
