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
      <div class="bar-actions">
        <v-switch
          v-if="isGit"
          v-model="logAllBranches"
          class="allrefs"
          label="所有分支"
          density="compact"
          hide-details
          color="primary"
          title="连本地分支、远端跟踪分支与标签一起列，便于看时间线"
        />
        <v-btn-toggle
          v-model="logDiffScope"
          density="compact"
          variant="text"
          divided
          mandatory
        >
          <v-btn value="hunks" size="small" title="只显示改动的片段">差异</v-btn>
          <v-btn value="file" size="small" title="显示整份文件，改动的行照样标出来">整文件</v-btn>
        </v-btn-toggle>
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
    </div>

    <p v-if="error" class="hint bad">{{ error }}</p>
    <p v-if="remote && remote.error" class="hint warn">
      远端没同步上：{{ remote.error }}，下面是上次同步到的记录。
    </p>

    <div ref="splitRef" class="split" :class="{ resizing }">
      <aside class="revs" :style="{ '--list-width': `${listWidth}px` }">
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
          <svg
            v-if="lineOf(entry)"
            class="graph"
            :style="{ width: `${graphWidth}px` }"
            aria-hidden="true"
          >
            <line
              v-for="seg in lineOf(entry).segments"
              :key="seg.key"
              :x1="seg.x1"
              :y1="seg.y1"
              :x2="seg.x2"
              :y2="seg.y2"
              :stroke="seg.color"
              stroke-width="1.6"
              stroke-linecap="round"
            />
            <circle :cx="lineOf(entry).x" :cy="DOT_Y" r="3.6" :fill="lineOf(entry).color" />
          </svg>
          <div class="revbody" :style="isGit ? { paddingLeft: `${graphWidth}px` } : null">
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
        </div>
        <div v-if="entries.length && !exhausted" class="more">
          <v-btn size="small" variant="text" color="primary" :loading="moreLoading" @click="more">
            加载更多
          </v-btn>
        </div>
      </aside>

      <SplitHandle axis="x" :active="resizing" @start="startSplit" @reset="resetSplit" />

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
            <pre class="message">{{ currentMessage }}</pre>
            <div
              v-if="detail && (detail.parents.length || detail.refs.length)"
              class="extra"
            >
              <span v-for="mark in detail.refs" :key="mark" class="extra-tag mono">{{ mark }}</span>
              <span v-if="detail.parents.length" class="extra-parent mono">
                父提交 {{ detail.parents.map((sha) => sha.slice(0, 7)).join(' ') }}
              </span>
            </div>
          </div>

          <div
            ref="bodyRef"
            class="body"
            :class="{ dragging, 'diff-collapsed': diffCollapsed }"
          >
            <div class="pane files" :class="{ collapsed: filesCollapsed }" :style="filesStyle">
              <div class="pane-head">
                <div class="head-left">
                  <span class="pane-title">改动的文件</span>
                  <span class="pane-count">{{ current.paths.length }}</span>
                </div>
                <div class="head-right">
                  <v-btn-toggle
                    v-model="logFilesMode"
                    class="files-mode"
                    variant="text"
                    divided
                    mandatory
                  >
                    <v-btn
                      value="flat"
                      size="x-small"
                      icon="mdi-view-list-outline"
                      title="平铺列表"
                    />
                    <v-btn
                      value="tree"
                      size="x-small"
                      icon="mdi-file-tree-outline"
                      title="目录树"
                    />
                  </v-btn-toggle>
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
              </div>
              <div v-show="!filesCollapsed" class="paths">
                <template v-for="row in pathRows" :key="row.kind + ':' + row.path">
                  <div
                    v-if="row.kind === 'dir'"
                    class="path dir"
                    :style="{ paddingLeft: 6 + row.depth * 14 + 'px' }"
                    :title="row.path"
                    @click="toggleDir(row.path)"
                  >
                    <v-icon size="14" class="chev">
                      {{ collapsedDirs[row.path] ? 'mdi-chevron-right' : 'mdi-chevron-down' }}
                    </v-icon>
                    <v-icon size="14" class="dir-icon">mdi-folder-outline</v-icon>
                    <span class="mono name">{{ row.name }}</span>
                    <span class="dir-count">{{ row.count }}</span>
                  </div>
                  <div
                    v-else
                    class="path"
                    :class="{ active: activePath === row.path }"
                    :style="{ paddingLeft: 6 + row.depth * 14 + 'px' }"
                    :title="row.path"
                    @click="openPath(row.path)"
                  >
                    <span class="letter" :style="{ color: tone(row.item.action) }">
                      {{ row.item.action }}
                    </span>
                    <span class="mono name">{{ row.label }}</span>
                  </div>
                </template>
                <p v-if="!current.paths.length" class="none">这次提交没有列出变更路径。</p>
              </div>
            </div>

            <SplitHandle
              axis="y"
              :active="dragging"
              :disabled="filesCollapsed || diffCollapsed"
              title="拖动调整两块区域的高度，双击还原"
              @start="startDrag"
              @reset="resetFiles"
            />

            <div class="pane diffpane" :class="{ collapsed: diffCollapsed }">
              <DiffView
                v-if="!diffCollapsed"
                :title="diffTitle"
                :path="activePath"
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
                <div class="head-left">
                  <span class="pane-title mono folded-title" :title="diffTitle">{{ diffTitle }}</span>
                </div>
                <div class="head-right">
                  <v-btn icon size="x-small" variant="text" title="展开差异" @click="toggleDiff">
                    <v-icon size="18">mdi-chevron-up</v-icon>
                  </v-btn>
                </div>
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
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useStorage } from '@vueuse/core'
import { useTheme } from 'vuetify'
import DiffView from '@bash-scripts/web-shared/diff'
import { api } from '../composables/useApi'
import { buildGraph, DOT_Y } from '../composables/gitGraph'
import { SplitHandle } from '@bash-scripts/web-shared'
import { actionOf, firstLine, shortenPath, shortPath, when } from '../composables/format'
import { usePreferencesStore } from '../stores/preferences'
import { useFileTree } from '@bash-scripts/web-shared'
import { useSplitPane } from '@bash-scripts/web-shared'

const props = defineProps({
  ws: { type: Object, required: true },
  refresh: { type: Number, default: 0 },
})

// 差异口径与文件列表的查看方式记在全局偏好里，换工作副本也保持。
const preferences = usePreferencesStore()
const { logDiffScope, logFilesMode } = storeToRefs(preferences)

const theme = useTheme()
const dark = computed(() => theme.global.current.value.dark)
// 时间线默认连所有分支与标签一起列；关掉就只看当前分支与它的上游。
const logAllBranches = useStorage('dvcsx.log.all-branches', true)

const PAGE = 50
const entries = ref([])
const current = ref(null)
const detail = ref(null)
const remote = ref(null)
const activePath = ref('')
const content = ref({ text: '', truncated: false })
const loading = ref(false)
const moreLoading = ref(false)
const exhausted = ref(false)
const diffLoading = ref(false)
const error = ref('')
const diffError = ref('')

const bodyRef = ref(null)
const filesCollapsed = ref(false)
const diffCollapsed = ref(false)
// 文件列表占详情区的高度比例，拖动中间的分隔条改它。
const { size: filePct, resizing: dragging, start: startDrag, reset: resetFiles } = useSplitPane({
  area: bodyRef,
  initial: 35,
  min: 15,
  max: 82,
  axis: 'y',
  unit: 'pct',
  persist: 'dvcsx.log.files-pct',
})
// 左侧提交列表的宽度随分隔条拖动改变，双击分隔条还原。
const splitRef = ref(null)
const { size: listWidth, resizing, start: startSplit, reset: resetSplit } = useSplitPane({
  area: splitRef,
  initial: 320,
  min: 200,
  rightMin: 320,
  persist: 'dvcsx.log.list-width',
})
let diffSeq = 0

// 树形视图的收起状态与摊平交给公共的文件树，平铺视图自己拼。
const { rows: treeRows, collapsed: collapsedDirs, toggle: toggleDir } = useFileTree(
  () => (current.value ? current.value.paths : []),
  (file) => ({ item: file, label: shortenPath(file.name, 40) }),
)

const pathRows = computed(() => {
  const list = current.value ? current.value.paths : []
  if (logFilesMode.value !== 'tree') {
    return list.map((item) => ({
      kind: 'file',
      path: item.path,
      label: shortenPath(shortPath(item.path), 60),
      depth: 0,
      item,
    }))
  }
  return treeRows.value
})

const isGit = computed(() => props.ws.vcs === 'git')
// SVN 没有待推送这一说，只统计服务器上还没更新到工作副本的版本。
const pendingCount = computed(() => entries.value.filter((entry) => !entry.local).length)
// 列表里只放提交说明的第一行，详情取整段；取不到就退回第一行。
const currentMessage = computed(
  () =>
    (detail.value && detail.value.message) ||
    (current.value && current.value.message) ||
    '（没有写提交说明）',
)

// 提交上挂的分支与标签由后端一次查好；只是当前提交不在任何分支上时补一个 HEAD。
function refsOf(entry) {
  if (!isGit.value) return []
  const marks = []
  const seen = new Set()
  for (const ref of entry.labels || []) {
    if (seen.has(ref.name)) continue
    seen.add(ref.name)
    if (ref.kind === 'head') {
      marks.push({ kind: 'head', icon: 'mdi-source-branch', text: ref.name, title: '本地分支' })
    } else if (ref.kind === 'tag') {
      marks.push({ kind: 'tag', icon: 'mdi-tag-outline', text: ref.name, title: '标签' })
    } else {
      marks.push({
        kind: 'upstream',
        icon: 'mdi-cloud-outline',
        text: ref.name,
        title: '远端跟踪分支',
      })
    }
  }
  // 老服务端不给 labels 时按原来的 HEAD / 上游标记显示。
  if (!entry.labels) {
    if (entry.head) {
      marks.push({
        kind: 'head',
        icon: 'mdi-source-branch',
        text: (remote.value && remote.value.branch) || 'HEAD',
        title: '本地分支当前提交',
      })
    }
    if (entry.remote_tip && remote.value && remote.value.upstream) {
      marks.push({
        kind: 'upstream',
        icon: 'mdi-cloud-outline',
        text: remote.value.upstream,
        title: '远端跟踪分支的最新提交',
      })
    }
  }
  if (entry.head && !marks.some((mark) => mark.kind === 'head')) {
    marks.unshift({ kind: 'head', icon: 'mdi-source-branch', text: 'HEAD', title: '当前提交' })
  }
  return marks
}

// 时间线分列交给纯函数，换主题只是换一套颜色。
const LANE_COLORS = {
  light: ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d'],
  dark: ['#60a5fa', '#4ade80', '#fbbf24', '#f87171', '#c084fc', '#22d3ee', '#f472b6', '#a3e635'],
}

const graphRows = computed(() =>
  buildGraph(entries.value, dark.value ? LANE_COLORS.dark : LANE_COLORS.light),
)

const graphWidth = computed(() => (isGit.value ? graphRows.value.width : 0))

function lineOf(entry) {
  return isGit.value ? graphRows.value.rows.get(entry.revision) || null : null
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
    const data = await api.log(props.ws.id, PAGE, 0, true, logAllBranches.value)
    entries.value = data.entries || []
    exhausted.value = entries.value.length < PAGE
    remote.value = data.remote || null
    const hit = entries.value.find((e) => current.value && e.revision === current.value.revision)
    await select(hit || entries.value[0] || null)
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function more() {
  if (moreLoading.value || exhausted.value) return
  moreLoading.value = true
  try {
    const data = await api.log(
      props.ws.id,
      PAGE,
      entries.value.length,
      false,
      logAllBranches.value
    )
    const seen = new Set(entries.value.map((entry) => entry.revision))
    const fresh = (data.entries || []).filter((entry) => !seen.has(entry.revision))
    entries.value = entries.value.concat(fresh)
    exhausted.value = fresh.length < PAGE
  } catch (err) {
    error.value = err.message
  } finally {
    moreLoading.value = false
  }
}

async function select(entry) {
  current.value = entry
  detail.value = null
  activePath.value = ''
  content.value = { text: '', truncated: false }
  diffError.value = ''
  if (!entry) return
  loadDetail(entry)
  // 提交里的文件常常好几个，默认打开第一个，省一次点击。
  if (entry.paths.length) await openPath(entry.paths[0].path)
}

async function loadDetail(entry) {
  try {
    const data = await api.commit(props.ws.id, entry.revision)
    // 连点不同提交时，晚到的旧结果不能盖住当前选中的说明。
    if (current.value && current.value.revision === entry.revision) detail.value = data
  } catch (err) {
    // 取不到就继续用列表里的第一行，不影响看差异。
  }
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
  const mine = ++diffSeq
  diffLoading.value = true
  diffError.value = ''
  try {
    const data = await api.revision(
      props.ws.id,
      current.value.revision,
      path,
      logDiffScope.value === 'file'
    )
    // 连点提交或来回切口径时，晚到的旧结果不能盖住当前这一份。
    if (mine === diffSeq) content.value = data
  } catch (err) {
    if (mine !== diffSeq) return
    content.value = { text: '', truncated: false }
    diffError.value = err.message
  } finally {
    if (mine === diffSeq) diffLoading.value = false
  }
}

// 切换差异口径时按当前看的内容重新取一遍。
watch(logDiffScope, () => {
  if (current.value) loadDiff(activePath.value)
})
watch(() => props.ws.id, load)
watch(() => props.refresh, load)
watch(logAllBranches, load)
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
  flex-wrap: wrap;
  gap: 6px 12px;
  padding: 6px 12px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}
/* 分支、上游这些字可以截断，右边两个切换钮不跟着缩，免得挤成滚动条。 */
.count {
  flex: 1 1 180px;
  min-width: 0;
  overflow: hidden;
  font-size: 0.76rem;
  color: rgb(var(--v-theme-on-surface-variant));
  white-space: nowrap;
  text-overflow: ellipsis;
}
.bar-actions {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 4px;
  margin-left: auto;
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
.revs {
  width: var(--list-width, 320px);
  flex: 0 0 var(--list-width, 320px);
  overflow: auto;
}
.revitem {
  position: relative;
  padding: 8px 10px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.07);
  cursor: pointer;
}
/* 时间线画在整行左侧，行高跟着内容走，不占布局。 */
.graph {
  position: absolute;
  top: 0;
  left: 6px;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}
.revbody {
  min-width: 0;
}
.allrefs {
  flex: 0 0 auto;
  margin: 0 4px 0 0;
}
.allrefs :deep(.v-label) {
  font-size: 0.76rem;
  opacity: 1;
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
.more {
  display: flex;
  justify-content: center;
  padding: 6px 0 12px;
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
.ref.tag {
  color: rgb(var(--v-theme-modified));
  border: 1px solid rgba(var(--v-theme-modified), 0.4);
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
  font-size: 0.84rem;
  white-space: pre-wrap;
  word-break: break-word;
}
.extra {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.extra-tag {
  padding: 0 6px;
  border-radius: 6px;
  font-size: 0.68rem;
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.12);
}
.extra-parent {
  font-size: 0.7rem;
  color: rgb(var(--v-theme-on-surface-variant));
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
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 2px 8px;
  min-width: 0;
  min-height: 32px;
  padding: 0 6px 0 12px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
/* 左边标题让位截断，右边两个切换钮和收起按钮按自身宽度占位。 */
.head-left {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.head-right {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 4px;
}
/* 切换钮里这两个图标按钮不许被压小，否则图标会被裁掉。 */
.files-mode :deep(.v-btn) {
  flex: 0 0 auto;
}
.pane-title {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  font-size: 0.76rem;
  color: rgb(var(--v-theme-on-surface-variant));
  white-space: nowrap;
  text-overflow: ellipsis;
}
.pane-count {
  flex: 0 0 auto;
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
  flex: 1 1 auto;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.chev {
  flex: 0 0 14px;
  color: rgb(var(--v-theme-on-surface-variant));
}
.dir-icon {
  flex: 0 0 auto;
  color: rgb(var(--v-theme-primary));
}
.dir-count {
  flex: 0 0 auto;
  min-width: 18px;
  padding: 0 5px;
  border-radius: 9px;
  text-align: center;
  font-size: 0.66rem;
  color: rgb(var(--v-theme-on-surface-variant));
  background: rgba(var(--v-theme-on-surface), 0.08);
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
    border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  }
  .vgutter {
    display: none;
  }
}
</style>
