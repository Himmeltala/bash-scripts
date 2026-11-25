<!--
 * @Author: Himmeltala
 * @Date: 2026-11-12 15:44:39
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 22:53:37
 * @FilePath: \idex\web\src\features\log\components\LogPanel.vue
 * @Description: 按时间线列出提交历史，查看提交说明与逐文件差异。
-->
<template>
  <div class="panel">
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
              <span class="date">{{ formatDateTime(entry.date) }}</span>
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
              <span class="date">{{ formatDateTime(current.date) }}</span>
              <v-spacer />
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
                    <v-icon
                      v-if="marked(row.path)"
                      size="14"
                      class="held"
                      title="默认不渲染，点开才加载差异"
                    >
                      mdi-eye-off-outline
                    </v-icon>
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
              <EmptyState
                v-if="!diffCollapsed && awaitingLoad"
                icon="mdi-file-hidden"
                :icon-size="28"
                :path="activePath"
                hint="这是锁文件、构建产物，或单行超过 2000 字符的文件，默认不加载差异。"
                action="加载差异"
                action-icon="mdi-eye-outline"
                @action="showDeferred"
              />
              <template v-else-if="!diffCollapsed && texts.ready">
                <div class="rich-actions">
                  <v-btn
                    size="small"
                    :variant="logDiffScope === 'hunks' ? 'flat' : 'text'"
                    :color="logDiffScope === 'hunks' ? 'primary' : undefined"
                    title="只显示改动的片段"
                    @click="logDiffScope = 'hunks'"
                  >
                    仅改动
                  </v-btn>
                  <v-btn
                    size="small"
                    :variant="logDiffScope === 'file' ? 'flat' : 'text'"
                    :color="logDiffScope === 'file' ? 'primary' : undefined"
                    title="显示整份文件，改动的行照样标出来"
                    @click="logDiffScope = 'file'"
                  >
                    整份文件
                  </v-btn>
                  <v-btn
                    size="small"
                    :variant="mergeInline ? 'text' : 'flat'"
                    :color="mergeInline ? undefined : 'primary'"
                    title="左右对照"
                    @click="mergeInline = false"
                  >
                    并排
                  </v-btn>
                  <v-btn
                    size="small"
                    :variant="mergeInline ? 'flat' : 'text'"
                    :color="mergeInline ? 'primary' : undefined"
                    title="单栏内联差异"
                    @click="mergeInline = true"
                  >
                    内联
                  </v-btn>
                  <v-spacer />
                  <v-btn icon size="x-small" variant="text" title="收起差异" @click="toggleDiff">
                    <v-icon size="18">mdi-chevron-down</v-icon>
                  </v-btn>
                </div>
                <MergeDiffEditor
                  :original="texts.original"
                  :model-value="texts.current"
                  :path="activePath"
                  :inline="mergeInline"
                  :collapse="logDiffScope === 'hunks'"
                  :theme="preferences.editorTheme"
                  :minimap="preferences.minimap"
                  :lsp="false"
                />
              </template>
              <DiffView
                v-else-if="!diffCollapsed"
                :title="diffTitle"
                :path="activePath"
                :text="content.text"
                kind="diff"
                :truncated="content.truncated"
                :loading="diffLoading"
                :error="diffError"
              >
                <template #actions>
                  <v-btn-toggle
                    v-model="logDiffScope"
                    density="compact"
                    variant="text"
                    divided
                    mandatory
                  >
                    <v-btn value="hunks" size="small" title="只显示改动的片段">仅改动</v-btn>
                    <v-btn value="file" size="small" title="显示整份文件，改动的行照样标出来">整份文件</v-btn>
                  </v-btn-toggle>
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
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'

import { useTheme } from 'vuetify'
import { useStoredChoice } from '@bash-scripts/web-shared'
import DiffView from '@bash-scripts/web-shared/diff'
import { EmptyState } from '@bash-scripts/web-shared/layouts'
import { buildGraph, DOT_Y } from '../lib/gitGraph'
import { SplitHandle } from '@bash-scripts/web-shared/layouts'
import { formatDateTime } from '@bash-scripts/web-shared/format'
import { firstLine, shortenPath, shortPath } from '../../../utils/format'
import {
  LANE_COLORS,
  refsOf as marksOfEntry,
  revLabel as revTextOf,
  stateOf as stateOfEntry,
  tone,
} from '../lib/logView'
import { useCommitLog } from '../composables/useCommitLog'
import MergeDiffEditor from '../../editor/components/MergeDiffEditor.vue'
import { toast } from '../../../utils/notice'
import { usePreferencesStore } from '../../../stores/preferences'
import { useFileTree, useSplitPane } from '@bash-scripts/web-shared'

const props = defineProps({
  ws: { type: Object, required: true },
  refresh: { type: Number, default: 0 },
})

// 差异口径与文件列表的查看方式记在全局偏好里，换工作副本也保持。
const preferences = usePreferencesStore()
const { logDiffScope, logFilesMode } = storeToRefs(preferences)

const theme = useTheme()
const dark = computed(() => theme.global.current.value.dark)
// 时间线只看当前分支与它的上游。

const isGit = computed(() => props.ws.vcs === 'git')

// 取数与选中状态交给组合式函数，这边只管布局与画时间线。
const {
  entries,
  current,
  detail,
  remote,
  activePath,
  content,
  texts,
  marked,
  awaitingLoad,
  loading,
  moreLoading,
  exhausted,
  diffLoading,
  error,
  diffError,
  load,
  more,
  select,
  openPath,
  showDeferred,
} = useCommitLog({
  wsId: () => props.ws.id,
  refresh: () => props.refresh,
  allBranches: ref(false),
  diffScope: logDiffScope,
  isGit: () => isGit.value,
})

watch(error, (text) => {
  if (text) toast(text, 'error')
})

const bodyRef = ref(null)
const filesCollapsed = ref(false)
const diffCollapsed = ref(false)
// 提交里的差异默认左右对照，也可以收成单栏内联。
const mergeInline = ref(false)
// 文件列表占详情区的高度比例，拖动中间的分隔条改它。
const { size: filePct, resizing: dragging, start: startDrag, reset: resetFiles } = useSplitPane({
  area: bodyRef,
  initial: 35,
  min: 15,
  max: 82,
  axis: 'y',
  unit: 'pct',
  persist: 'idex.log.files-pct',
})
// 左侧提交列表的宽度随分隔条拖动改变，双击分隔条还原。
const splitRef = ref(null)
const { size: listWidth, resizing, start: startSplit, reset: resetSplit } = useSplitPane({
  area: splitRef,
  initial: 320,
  min: 200,
  rightMin: 320,
  persist: 'idex.log.list-width',
})

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

// SVN 没有待推送这一说，只统计服务器上还没更新到工作副本的版本。
// 列表里只放提交说明的第一行，详情取整段；取不到就退回第一行。
const currentMessage = computed(
  () =>
    (detail.value && detail.value.message) ||
    (current.value && current.value.message) ||
    '（没有写提交说明）',
)

// 提交上的分支标签、推送状态、版本号都是纯函数，参数在这里补齐。
function refsOf(entry) {
  return marksOfEntry(entry, isGit.value, remote.value)
}

function stateOf(entry) {
  return stateOfEntry(entry, isGit.value)
}

function revLabel(rev) {
  return revTextOf(rev, isGit.value)
}

const graphRows = computed(() =>
  buildGraph(entries.value, dark.value ? LANE_COLORS.dark : LANE_COLORS.light),
)

const graphWidth = computed(() => (isGit.value ? graphRows.value.width : 0))

function lineOf(entry) {
  return isGit.value ? graphRows.value.rows.get(entry.revision) || null : null
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

const diffTitle = computed(() => {
  if (!current.value) return ''
  const rev = revLabel(current.value.revision)
  return activePath.value ? `${rev}  ${activePath.value}` : rev
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
.rich-actions {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
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
.held {
  flex: 0 0 auto;
  color: rgb(var(--v-theme-on-surface-variant));
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
</style>
