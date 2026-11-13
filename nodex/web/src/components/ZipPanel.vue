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
        <p v-if="root.loading" class="hint">正在读取目录…</p>
        <p v-else-if="root.error" class="hint bad">{{ root.error }}</p>
        <p v-else-if="!root.entries.length" class="hint">这个工作区是空的。</p>
        <template v-else>
          <ZipTree
            v-for="node in root.entries"
            :key="node.rel"
            :node="node"
            :expanded="expanded"
            :cache="cache"
            :picked="picked"
            @toggle="toggle"
            @pick="togglePick"
          />
          <p v-if="root.truncated" class="hint">这一层太多，只列了前面一部分。</p>
        </template>
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
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import ZipTree from './ZipTree.vue'
import { api } from '../composables/useApi'
import { colorize } from '../composables/logColor'
import { copyText } from '../composables/clipboard'
import { baseName, sizeText } from '../composables/format'

const props = defineProps({
  ws: { type: Object, required: true },
  dark: { type: Boolean, default: false },
  active: { type: Boolean, default: false },
})

// 目录树跟浏览目录一路：展开状态与读过的孩子各存一份，节点自己不带副本。
const expanded = reactive({})
const cache = reactive({})
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
let loadedFor = ''

const root = computed(
  () => cache[''] || { loading: false, error: '', entries: [], truncated: false },
)

function covered(rel) {
  return picked.value.some((item) => rel !== item && rel.startsWith(`${item}/`))
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

function setRoot(data) {
  cache[''] = {
    loading: false,
    error: '',
    entries: data.entries || [],
    truncated: !!data.truncated,
  }
}

async function loadRoot() {
  cache[''] = { loading: true, error: '', entries: [], truncated: false }
  try {
    setRoot(await api.entries(props.ws.id, ''))
  } catch (err) {
    cache[''] = { loading: false, error: err.message, entries: [], truncated: false }
  }
}

async function toggle(rel) {
  expanded[rel] = !expanded[rel]
  if (!expanded[rel] || cache[rel]) return
  cache[rel] = { loading: true, error: '', entries: [], truncated: false }
  try {
    const data = await api.entries(props.ws.id, rel)
    cache[rel] = {
      loading: false,
      error: '',
      entries: data.entries || [],
      truncated: !!data.truncated,
    }
  } catch (err) {
    cache[rel] = { loading: false, error: err.message, entries: [], truncated: false }
  }
}

function reload() {
  for (const rel of Object.keys(cache)) delete cache[rel]
  for (const rel of Object.keys(expanded)) delete expanded[rel]
  loadRoot()
}

function reset() {
  picked.value = []
  name.value = `${baseName(props.ws.root)}.zip`
  error.value = ''
  log.value = ''
  status.value = null
  saved.value = null
  for (const rel of Object.keys(cache)) delete cache[rel]
  for (const rel of Object.keys(expanded)) delete expanded[rel]
  // 切到这一栏时才读目录，没点开过的不白读。
  if (props.active) loadRoot()
}

function activate() {
  if (loadedFor === props.ws.id) return
  loadedFor = props.ws.id
  loadRoot()
}

watch(
  () => props.ws.id,
  () => {
    loadedFor = ''
    closeLog()
    stopTimer()
    running.value = false
    reset()
  }
)

watch(
  () => props.active,
  (on) => {
    if (on) activate()
  }
)

if (props.active) activate()

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
