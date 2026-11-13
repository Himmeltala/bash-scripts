<template>
  <div class="zip">
    <div class="tree-side">
      <div class="tree-head">
        <span class="label">工作区目录</span>
        <v-spacer />
        <span class="meta">已选 {{ picked.length }} 项</span>
        <v-btn size="x-small" variant="text" :disabled="!picked.length" @click="clearPicks">清空</v-btn>
        <v-btn size="x-small" variant="text" prepend-icon="mdi-refresh" @click="reload">重读</v-btn>
      </div>
      <div class="tree">
        <FileTree
          ref="treeRef"
          :key="ws.id"
          :loader="loadLayer"
          :key-of="keyOf"
          :dir-of="dirOf"
          label-class="mono"
          :root-path="ws.root"
          :download-of="downloadOf"
          :row-class="rowClass"
          :active="active"
          :texts="treeTexts"
          @pick="togglePick"
        >
          <template #row-before-label="{ node }">
            <v-checkbox-btn
              class="pick"
              density="compact"
              :model-value="checked(node)"
              :disabled="node.excluded || locked(node)"
              @update:model-value="togglePick(node)"
            />
          </template>
          <template #row-after-label="{ node }">
            <span v-if="node.excluded" class="meta">默认排除</span>
            <span v-else-if="!node.dir && node.size" class="meta">{{ sizeText(node.size) }}</span>
          </template>
        </FileTree>
      </div>
    </div>

    <div class="side">
      <div class="form">
        <v-text-field
          v-model="name"
          label="包名"
          density="compact"
          variant="outlined"
          hide-details
          class="name-field"
          hint="落在工作区根目录；写子路径也行"
          persistent-hint
        />
      </div>
      <div class="ops">
        <v-chip v-if="status" size="small" variant="tonal" :color="status.color" :prepend-icon="status.icon">
          {{ status.text }}
        </v-chip>
        <v-spacer />
        <v-btn
          size="small"
          color="primary"
          variant="flat"
          prepend-icon="mdi-package-variant"
          :loading="running"
          :disabled="!picked.length || running"
          @click="start"
        >
          打包
        </v-btn>
      </div>
      <div v-if="saved" class="out">
        <a class="dl" :href="saved.url" :download="saved.name" :title="saved.path">
          <v-icon size="18" color="primary">mdi-download</v-icon>
          <span class="dl-name mono">{{ saved.name }}</span>
          <span class="meta">{{ sizeText(saved.size) }}</span>
        </a>
        <v-btn
          size="small"
          variant="text"
          prepend-icon="mdi-content-copy"
          title="复制完整路径，几条命令搬走更快"
          @click="copyPath"
        >
          复制路径
        </v-btn>
        <span v-if="copied" class="meta">已复制</span>
      </div>
      <p v-if="error" class="hint bad">{{ error }}</p>
      <div class="log">
        <LogView v-if="log" :text="log" :dark="dark" :colorize="colorize" />
        <p v-else class="hint">还没有打过包。勾选左边的文件或目录，点「打包」。</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { FileTree } from '@bash-scripts/web-shared'
import { api } from '../composables/useApi'
import { colorize } from '../composables/logColor'
import { copyText } from '../composables/clipboard'
import { baseName, sizeText } from '../composables/format'

const props = defineProps({
  ws: { type: Object, required: true },
  dark: { type: Boolean, default: false },
  active: { type: Boolean, default: false },
})

const treeRef = ref(null)
// 勾中的条目按相对路径存；父目录也在里面时，后端提交前会去掉多余的那条。
const picked = ref([])
const name = ref(`${baseName(props.ws.root)}.zip`)
const error = ref('')
const log = ref('')
const running = ref(false)
const status = ref(null)
const saved = ref(null)
const copied = ref(false)

let logSource = null
let timer = null
let copiedTimer = null

// 树里的节点用 rel 认路、dir 判断目录；行内的勾选状态由这一侧提供。
const loadLayer = (rel) => api.entries(props.ws.id, rel)
const downloadOf = (node) => api.entryUrl(props.ws.id, node.rel)
const keyOf = (node) => node.rel
const dirOf = (node) => node.dir
const rowClass = (node) => ({ excluded: node.excluded })
const treeTexts = {
  rootLoading: '正在读取目录…',
  rootEmpty: '这个工作区是空的。',
  truncated: '这一层太多，只列了前面一部分。',
}

function covered(rel) {
  return picked.value.some((item) => rel !== item && rel.startsWith(`${item}/`))
}

// 目录被勾中时它下面的条目也算在里面，显示成勾上但点不动。
function locked(node) {
  return picked.value.some((rel) => rel !== node.rel && node.rel.startsWith(`${rel}/`))
}

function checked(node) {
  return picked.value.includes(node.rel) || locked(node)
}

function togglePick(node) {
  if (node.excluded || covered(node.rel)) return
  const at = picked.value.indexOf(node.rel)
  if (at >= 0) picked.value.splice(at, 1)
  else picked.value.push(node.rel)
}

function clearPicks() {
  picked.value = []
}

function reload() {
  treeRef.value?.reload()
}

function reset() {
  picked.value = []
  name.value = `${baseName(props.ws.root)}.zip`
  error.value = ''
  log.value = ''
  status.value = null
  saved.value = null
}

watch(
  () => props.ws.id,
  () => {
    closeLog()
    stopTimer()
    running.value = false
    reset()
  }
)

async function start() {
  if (running.value || !picked.value.length) return
  error.value = ''
  const payload = { ws: props.ws.id, name: name.value.trim(), entries: [...picked.value] }
  try {
    await submit(payload)
  } catch (err) {
    running.value = false
    status.value = null
    error.value = err.message
  }
}

async function submit(payload) {
  running.value = true
  status.value = { text: '打包中', color: 'warning', icon: 'mdi-progress-clock' }
  saved.value = null
  log.value = ''
  const data = await api.zip(payload)
  name.value = data.name
  openLog(data.run)
  poll(data.run)
}

function openLog(run) {
  closeLog()
  const source = new EventSource(api.logStreamUrl(run))
  logSource = source
  source.addEventListener('tail', (ev) => {
    const data = JSON.parse(ev.data)
    log.value = data.text || ''
  })
  source.addEventListener('append', (ev) => {
    const data = JSON.parse(ev.data)
    if (data.text) log.value = log.value ? `${log.value}\n${data.text}` : data.text
  })
}

async function copyPath() {
  if (!saved.value) return
  copied.value = await copyText(saved.value.path)
  clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => {
    copied.value = false
  }, 1600)
}

function closeLog() {
  if (logSource) {
    logSource.close()
    logSource = null
  }
}

function stopTimer() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

// 退出码落在日志旁边的 .code 文件里，进程没退出来之前一直问。
function poll(run) {
  stopTimer()
  timer = setInterval(async () => {
    try {
      const data = await api.zipStatus(run)
      if (data.running) return
      stopTimer()
      running.value = false
      if (data.code === 0) {
        status.value = { text: '已完成', color: 'ready', icon: 'mdi-check-circle' }
        const target = data.name || name.value
        saved.value = {
          name: target,
          path: data.path,
          size: data.size,
          url: api.downloadUrl(props.ws.id, target),
        }
      } else {
        status.value = { text: '失败', color: 'failed', icon: 'mdi-alert-circle' }
        error.value = `zipx 退出码 ${data.code}，看下面的日志`
      }
      // 进程刚退出时最后几行可能还没推到页面上，稍等一下再断开。
      setTimeout(closeLog, 600)
    } catch (err) {
      stopTimer()
      running.value = false
      error.value = err.message
    }
  }, 700)
}

onBeforeUnmount(() => {
  closeLog()
  stopTimer()
  clearTimeout(copiedTimer)
})
</script>

<style scoped>
/* 面板是纵向弹性布局，这一栏吃掉标题与栏目之外的高度，目录树与日志各自滚。 */
.zip {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
}
.tree-side {
  flex: 0 0 46%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}
.tree-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
.tree-head .label {
  font-size: 0.82rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.tree {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: 4px 0 24px;
}
.meta {
  flex: 0 0 auto;
  font-size: 0.7rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.pick {
  flex: 0 0 auto;
  margin-inline: 2px;
}
.side {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 10px 12px 12px;
  gap: 10px;
}
.form {
  flex: 0 0 auto;
}
.ops {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.out {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.dl {
  flex: 0 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 6px 10px;
  border: 1px solid rgba(var(--v-theme-primary), 0.35);
  border-radius: 6px;
  text-decoration: none;
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.06);
}
.dl:hover {
  background: rgba(var(--v-theme-primary), 0.12);
}
.dl-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.84rem;
}
.log {
  flex: 1 1 auto;
  min-height: 120px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 6px;
}
.hint {
  margin: 12px;
  font-size: 0.82rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.hint.bad {
  color: rgb(var(--v-theme-error));
}
@media (max-width: 900px) {
  .zip {
    flex-direction: column;
  }
  .tree-side {
    flex: 0 0 auto;
    max-height: 45vh;
    border-right: none;
    border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  }
  .log {
    min-height: 220px;
  }
}
</style>
