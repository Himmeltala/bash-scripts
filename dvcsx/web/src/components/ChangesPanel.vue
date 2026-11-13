<template>
  <div class="panel">
    <div class="bar">
      <div class="meta">
        <span class="url mono" :title="info.url || ws.root">{{ info.url || ws.root }}</span>
        <span v-if="isGit && info.branch" class="rev">{{ info.branch }}</span>
        <span v-if="info.revision" class="rev">{{ revText }}</span>
        <span class="count">{{ files.length }} 项变更</span>
        <span v-if="truncated" class="count warn" title="未纳入版本控制的文件太多">
          只列了前 200 个未纳入版本控制的文件
        </span>
      </div>
      <div class="bar-actions">
        <v-btn-toggle
          v-model="mode"
          variant="text"
          divided
          mandatory
          class="modes"
        >
          <v-btn value="flat" size="small" icon="mdi-view-list-outline" title="平铺列表" />
          <v-btn value="tree" size="small" icon="mdi-file-tree-outline" title="目录树" />
        </v-btn-toggle>
        <v-btn-toggle
          v-model="diffScope"
          density="compact"
          variant="text"
          divided
          mandatory
          class="scopes"
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

    <div ref="splitRef" class="split" :class="{ resizing }">
      <aside class="files" :style="{ '--list-width': `${listWidth}px` }">
        <p v-if="!loading && !files.length" class="none">工作副本是干净的，没有未提交的变更。</p>
        <ul>
          <li
            v-for="row in rows"
            :key="row.kind + ':' + row.path"
            class="item"
            :class="{ active: row.kind === 'file' && selected && selected.path === row.path }"
            :style="{ paddingLeft: 8 + row.depth * 16 + 'px' }"
            :title="row.kind === 'dir' ? row.path : null"
            @click="row.kind === 'dir' ? toggleDir(row.path) : pick(row.file)"
          >
            <template v-if="row.kind === 'dir'">
              <v-icon size="16" class="chev">
                {{ collapsedDirs[row.path] ? 'mdi-chevron-right' : 'mdi-chevron-down' }}
              </v-icon>
              <v-icon size="16" class="dir-icon">
                {{ collapsedDirs[row.path] ? 'mdi-folder-outline' : 'mdi-folder-open-outline' }}
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
              <span class="state">{{ statusOf(row.file.item).text }}</span>
            </template>
          </li>
        </ul>
      </aside>

      <SplitHandle axis="x" :active="resizing" @start="startSplit" @reset="resetSplit" />

      <section class="view">
        <DiffView
          :title="diffTitle"
          :path="selected ? selected.path : ''"
          :text="content.text"
          :kind="content.kind"
          :truncated="content.truncated"
          :loading="diffLoading"
          :error="diffError"
        />
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import DiffView from './DiffView.vue'
import SplitHandle from './SplitHandle.vue'
import { api } from '../composables/useApi'
import { fileIcon } from '@bash-scripts/web-shared'
import { baseName, dirName, statusOf } from '../composables/format'
import { usePreferencesStore } from '../stores/preferences'
import { useFileTree } from '@bash-scripts/web-shared'
import { useSplitPane } from '@bash-scripts/web-shared'

const props = defineProps({
  ws: { type: Object, required: true },
  refresh: { type: Number, default: 0 },
})
const emit = defineEmits(['loaded'])

const info = ref({})
const files = ref([])
const truncated = ref(false)
const selected = ref(null)
const content = ref({ text: '', kind: 'diff', truncated: false })
const loading = ref(false)
const diffLoading = ref(false)
const error = ref('')
const diffError = ref('')

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
  persist: 'dvcsx.changes.list-width',
})

const isGit = computed(() => props.ws.vcs === 'git')
const diffTitle = computed(() => (selected.value ? selected.value.path : ''))
// SVN 的版本号前面带 r，Git 给的是短 sha，原样显示。
const revText = computed(() => {
  const rev = info.value.revision
  if (!rev) return ''
  return isGit.value ? rev : `r${rev}`
})

function tone(file) {
  return `rgb(var(--v-theme-${statusOf(file.item).color}))`
}

// 与浏览目录共用同一套文件类型图标。
function iconOf(file) {
  return fileIcon(file.path)
}

// 树形视图的收起状态与摊平交给公共的文件树，平铺视图自己拼。
const { rows: treeRows, collapsed: collapsedDirs, toggle: toggleDir } = useFileTree(files)

const rows = computed(() => {
  if (mode.value !== 'tree') {
    return files.value.map((file) => ({
      kind: 'file',
      name: baseName(file.path),
      path: file.path,
      depth: 0,
      file,
    }))
  }
  return treeRows.value
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await api.changes(props.ws.id)
    info.value = data.info || {}
    files.value = data.files || []
    truncated.value = !!data.truncated
    emit('loaded', files.value.length)
    // 选中的文件还在列表里就留着，不在就退回第一项，右侧不至于空着。
    const hit = files.value.find((f) => selected.value && f.path === selected.value.path)
    if (hit) {
      selected.value = hit
    } else {
      selected.value = null
      content.value = { text: '', kind: 'diff', truncated: false }
      if (files.value.length) await pick(files.value[0])
    }
  } catch (err) {
    error.value = err.message
    emit('loaded', 0)
  } finally {
    loading.value = false
  }
}

async function pick(file) {
  selected.value = file
  diffLoading.value = true
  diffError.value = ''
  try {
    content.value = await api.diff(
      props.ws.id,
      file.path,
      file.item,
      diffScope.value === 'file'
    )
  } catch (err) {
    content.value = { text: '', kind: 'diff', truncated: false }
    diffError.value = err.message
  } finally {
    diffLoading.value = false
  }
}

// 切换差异口径时按当前文件重新取一遍。
watch(diffScope, () => {
  if (selected.value) pick(selected.value)
})
watch(() => props.ws.id, load)
watch(() => props.refresh, load)
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
.bar-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}
.meta {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.url {
  font-size: 0.78rem;
  color: rgb(var(--v-theme-on-surface-variant));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rev,
.warn {
  color: rgb(var(--v-theme-modified));
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
}
.files ul {
  list-style: none;
  margin: 0;
  padding: 4px;
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
@media (max-width: 900px) {
  .split {
    flex-direction: column;
  }
  .files {
    width: 100%;
    flex: 0 0 auto;
    max-height: 220px;
    border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  }
  .gutter {
    display: none;
  }
}
</style>
