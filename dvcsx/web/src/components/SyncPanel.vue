<template>
  <div class="panel">
    <div class="bar">
      <div class="meta">
        <template v-if="isGit">
          <span class="mono branch">
            {{ info.detached ? (info.has_head ? '（游离 HEAD）' : '（还没有提交）') : info.branch }}
          </span>
          <span v-if="info.upstream" class="mono up">{{ info.upstream }}</span>
          <span v-if="info.ahead" class="ab" title="本地分支比远端多出的提交">
            <v-icon size="12">mdi-arrow-up-bold</v-icon>{{ info.ahead }}
          </span>
          <span v-if="info.behind" class="ab" title="远端比本地分支多出的提交">
            <v-icon size="12">mdi-arrow-down-bold</v-icon>{{ info.behind }}
          </span>
        </template>
        <template v-else>
          <span class="mono up">{{ info.url }}</span>
          <span v-if="info.revision" class="rev">r{{ info.revision }}</span>
        </template>
      </div>
      <div class="bar-actions">
        <v-btn
          v-if="running"
          size="small"
          variant="text"
          color="error"
          prepend-icon="mdi-stop-circle-outline"
          :loading="canceling"
          @click="cancelJob"
        >
          取消
        </v-btn>
        <v-btn
          size="small"
          variant="text"
          color="primary"
          prepend-icon="mdi-refresh"
          :loading="loading"
          :disabled="busy"
          @click="load"
        >
          刷新
        </v-btn>
      </div>
    </div>

    <p v-if="error" class="hint bad">{{ error }}</p>
    <p v-if="info.writable === false" class="hint warn">
      当前页面不是从本机打开的，拉取、推送、更新与提交已禁用；要放开给其他机器，用 --allow-write 启动。
    </p>

    <div class="body">
      <section v-if="isGit" class="block">
        <h3>拉取</h3>
        <p class="hint">
          把远端跟踪分支的提交取回本地。默认只快进，不擅自合并或变基；遇到冲突会停下，冲突留在工作区。
        </p>
        <div class="row">
          <v-select
            v-model="pullMode"
            :items="pullModes"
            label="拉取方式"
            density="compact"
            hide-details
            class="mode"
          />
          <v-btn
            color="primary"
            prepend-icon="mdi-cloud-download-outline"
            :loading="running === 'pull'"
            :disabled="busy || info.writable === false || !info.upstream"
            @click="ask('pull')"
          >
            拉取
          </v-btn>
        </div>
        <p v-if="!info.upstream" class="hint warn">
          当前分支没有远端跟踪分支，先在终端里设一次。
        </p>

        <h3>推送</h3>
        <p class="hint">
          把当前分支的提交推到远端。不会强制推送；远端有新提交时命令会失败，先拉取再推。
        </p>
        <div class="row">
          <v-checkbox
            v-if="!info.upstream && info.remotes && info.remotes.length"
            v-model="setUpstream"
            label="设置上游并推送"
            density="compact"
            hide-details
          />
          <v-btn
            color="primary"
            prepend-icon="mdi-cloud-upload-outline"
            :loading="running === 'push'"
            :disabled="
              busy || info.writable === false || info.detached || (!info.upstream && !setUpstream)
            "
            @click="ask('push')"
          >
            推送
          </v-btn>
        </div>
        <p v-if="info.detached" class="hint warn">当前是游离 HEAD，先切到一个分支再推送。</p>
        <p v-else-if="!info.remotes || !info.remotes.length" class="hint warn">
          仓库没有配远端，先在终端里加一个。
        </p>
      </section>

      <section v-else class="block">
        <h3>更新</h3>
        <p class="hint">
          从服务器更新工作副本。有冲突时保留冲突标记，不自动取舍；解决后再提交。
        </p>
        <v-btn
          color="primary"
          prepend-icon="mdi-cloud-download-outline"
          :loading="running === 'update'"
          :disabled="busy || info.writable === false"
          @click="ask('update')"
        >
          更新
        </v-btn>
      </section>

      <section class="block">
        <h3>提交</h3>
        <p class="hint">
          <template v-if="isGit">
            勾选要提交的路径并填写提交说明。会先暂存选中的路径再提交；索引里如果有未选中的暂存改动，会拒绝提交。
          </template>
          <template v-else>
            勾选要提交的路径并填写提交说明。冲突与未纳入版本控制的路径不能提交。
          </template>
        </p>
        <v-textarea
          v-model="message"
          label="提交说明"
          rows="3"
          density="compact"
          variant="outlined"
          :maxlength="8000"
          counter
        />
        <div class="row picks">
          <v-btn size="x-small" variant="text" @click="pickAll">全选</v-btn>
          <v-btn size="x-small" variant="text" @click="picked = []">清空</v-btn>
          <span class="hint">已选 {{ picked.length }} 个</span>
        </div>
        <div class="files">
          <v-checkbox
            v-for="item in committable"
            :key="item.path"
            v-model="picked"
            :value="item.path"
            density="compact"
            hide-details
          >
            <template #label>
              <span class="mono path">{{ item.path }}</span>
              <span class="state">{{ itemLabel(item.item) }}</span>
            </template>
          </v-checkbox>
          <p v-if="!committable.length" class="hint">没有可提交的改动。</p>
        </div>
        <p v-if="info.conflicts && info.conflicts.length" class="hint bad">
          有冲突：{{ info.conflicts.join('、') }}。先解决冲突再提交。
        </p>
        <p v-if="missing.length" class="hint warn">
          本地缺失：{{ missing.join('、') }}。先 svn delete 再提交。
        </p>
        <v-btn
          color="primary"
          prepend-icon="mdi-source-commit"
          :loading="running === 'commit'"
          :disabled="busy || info.writable === false || !picked.length || !message.trim()"
          @click="ask('commit')"
        >
          提交
        </v-btn>
      </section>

      <section v-if="output" class="block">
        <h3>输出</h3>
        <TerminalOutput :text="output" :dark="dark" />
      </section>
      <p v-if="lastError" class="hint bad">{{ lastError }}</p>
    </div>

    <v-dialog v-model="confirmOn" max-width="540">
      <v-card>
        <v-card-title>{{ confirmTitle }}</v-card-title>
        <v-card-text>
          <p class="confirm-text">{{ confirmText }}</p>
          <p class="hint">执行后工作副本或远端会发生变化，请确认命令与目标都没问题。</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="confirmOn = false">取消</v-btn>
          <v-btn color="primary" variant="flat" :loading="!!running" @click="run">执行</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useTheme } from 'vuetify'
import TerminalOutput from './TerminalOutput.vue'
import { api, jobEventsUrl } from '../composables/useApi'
import { statusOf } from '../composables/format'

const props = defineProps({
  ws: { type: Object, required: true },
  refresh: { type: Number, default: 0 },
})
const emit = defineEmits(['done'])

const theme = useTheme()
const dark = computed(() => theme.global.current.value.dark)

const info = ref({})
const loading = ref(false)
const running = ref('')
const error = ref('')
const lastError = ref('')
const outputLines = ref([])
const commandLine = ref('')
const pending = ref('')
const confirmOn = ref(false)
const pullMode = ref('ff')
const setUpstream = ref(false)
const message = ref('')
const picked = ref([])
const pickedInitialized = ref(false)
const jobId = ref('')
const canceling = ref(false)

// 操作输出一行一行推过来，页面只维护这个数组。
const output = computed(() => outputLines.value.join('\n'))
let stream = null
let settled = false
let opened = 0

const pullModes = [
  { title: '只快进（推荐）', value: 'ff' },
  { title: '合并', value: 'merge' },
  { title: '变基', value: 'rebase' },
]

const isGit = computed(() => props.ws.vcs === 'git')
const busy = computed(() => !!running.value)
// Git 可以把未跟踪文件加进来；SVN 的未纳管、缺失路径与两者的冲突都不能提交。
const blockedItems = computed(() =>
  isGit.value ? ['conflicted'] : ['conflicted', 'unversioned', 'missing'],
)
const committable = computed(() =>
  (info.value.files || []).filter((item) => !blockedItems.value.includes(item.item)),
)
const missing = computed(() =>
  (info.value.files || []).filter((item) => item.item === 'missing').map((item) => item.path),
)

function itemLabel(item) {
  if (isGit.value && item === 'unversioned') return '未跟踪'
  return statusOf(item).text
}

const pullLabel = computed(
  () => pullModes.find((item) => item.value === pullMode.value)?.title || pullMode.value,
)

const confirmTitle = computed(
  () =>
    ({
      pull: '拉取远端提交',
      push: '推送当前分支',
      update: '更新工作副本',
      commit: isGit.value ? '提交到 Git' : '提交到 SVN',
    })[pending.value] || '确认操作',
)

const confirmText = computed(() => {
  switch (pending.value) {
    case 'pull':
      return `从 ${info.value.upstream || '远端'} 拉取到 ${info.value.branch || '当前分支'}，方式：${pullLabel.value}。`
    case 'push':
      return `把 ${info.value.branch || '当前分支'} 推到 ${info.value.upstream || '远端'}。`
    case 'update':
      return '从服务器更新工作副本。'
    case 'commit':
      return isGit.value
        ? `把 ${picked.value.length} 个路径提交到本地仓库，提交说明：${message.value.trim()}`
        : `把 ${picked.value.length} 个路径提交到服务器，提交说明：${message.value.trim()}`
    default:
      return ''
  }
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await api.syncInfo(props.ws.id)
    info.value = data
    const known = new Set(committable.value.map((item) => item.path))
    picked.value = picked.value.filter((path) => known.has(path))
    // 第一次打开提交页时把可提交的路径都勾上，之后保留用户自己的勾选。
    if (!pickedInitialized.value && known.size) {
      picked.value = [...known]
      pickedInitialized.value = true
    }
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
  attachRunningJob()
}

// 页面刷新或重新打开时，如果后台还有任务在跑，接上它的输出。
async function attachRunningJob() {
  if (busy.value || stream) return
  try {
    const data = await api.latestOperation(props.ws.id)
    const job = data.job
    if (!job || job.done || busy.value || stream) return
    running.value = job.action
    settled = false
    jobId.value = job.id
    commandLine.value = job.command || ''
    outputLines.value = commandLine.value ? [`$ ${commandLine.value}`, ''] : []
    streamJob(job.id, job.action)
  } catch (err) {
    // 接不上历史任务不影响查看页面。
  }
}

function pickAll() {
  picked.value = committable.value.map((item) => item.path)
}

function ask(action) {
  pending.value = action
  confirmOn.value = true
}

function appendLine(line) {
  outputLines.value.push(line)
  // 命令发疯刷屏时只留最近这些行，页面不至于卡死。
  if (outputLines.value.length > 5000) {
    outputLines.value.splice(0, outputLines.value.length - 5000)
  }
}

function closeStream() {
  if (stream) {
    stream.close()
    stream = null
  }
}

function finishStream(data, action) {
  if (settled) return
  settled = true
  closeStream()
  jobId.value = ''
  if (data && data.ok === false) {
    lastError.value = data.error || '操作没有成功，看上面的输出。'
  } else if (action === 'commit') {
    message.value = ''
  }
  running.value = ''
  emit('done', action)
  load()
}

function streamJob(id, action) {
  const es = new EventSource(jobEventsUrl(id))
  stream = es
  opened = 0
  es.onopen = () => {
    opened += 1
    // 断线重连时服务端会从头重放，先把本地已显示的行换回命令行。
    if (opened > 1) {
      outputLines.value = commandLine.value ? [`$ ${commandLine.value}`, ''] : []
    }
  }
  es.addEventListener('output', (event) => {
    try {
      appendLine(JSON.parse(event.data).line ?? '')
    } catch (err) {
      // 一行读不懂就跳过，不影响后面的输出。
    }
  })
  es.addEventListener('done', (event) => {
    let data = {}
    try {
      data = JSON.parse(event.data)
    } catch (err) {
      data = {}
    }
    finishStream(data, action)
  })
  es.onerror = async () => {
    // 任务结束后服务端主动关连接也会触发这里，done 处理过就不再管。
    if (settled) return
    // EventSource 会自己重连；顺手查一次任务状态，免得服务端没发完页面一直转。
    try {
      const data = await api.job(id)
      if (data.done) finishStream(data, action)
    } catch (err) {
      // 查不到就让 EventSource 继续重连。
    }
  }
}

async function run() {
  confirmOn.value = false
  const action = pending.value
  running.value = action
  settled = false
  outputLines.value = []
  commandLine.value = ''
  jobId.value = ''
  lastError.value = ''
  try {
    const body = { ws: props.ws.id, action }
    if (action === 'pull') body.mode = pullMode.value
    if (action === 'push') body.set_upstream = setUpstream.value
    if (action === 'commit') {
      body.message = message.value
      body.paths = picked.value
    }
    const data = await api.startOperation(body)
    jobId.value = data.id
    commandLine.value = data.command || ''
    if (commandLine.value) outputLines.value.push(`$ ${commandLine.value}`, '')
    streamJob(data.id, action)
  } catch (err) {
    lastError.value = err.message
    running.value = ''
    await load()
  }
}

async function cancelJob() {
  if (!jobId.value) return
  canceling.value = true
  try {
    await api.cancelOperation(jobId.value)
  } catch (err) {
    lastError.value = err.message
  } finally {
    canceling.value = false
  }
}

function reset() {
  settled = true
  closeStream()
  info.value = {}
  outputLines.value = []
  commandLine.value = ''
  lastError.value = ''
  error.value = ''
  pending.value = ''
  message.value = ''
  picked.value = []
  pickedInitialized.value = false
  setUpstream.value = false
  pullMode.value = 'ff'
  jobId.value = ''
  running.value = ''
  canceling.value = false
}

watch(
  () => props.ws.id,
  () => {
    reset()
    load()
  },
)
// 工作副本有变化或刚有操作结束时，外层会把这个数加一。
watch(
  () => props.refresh,
  () => {
    if (!busy.value) load()
  },
)
onMounted(load)
onBeforeUnmount(() => {
  settled = true
  closeStream()
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
.meta {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.bar-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}
.branch {
  font-weight: 600;
}
.up,
.rev {
  font-size: 0.78rem;
  color: rgb(var(--v-theme-on-surface-variant));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rev {
  color: rgb(var(--v-theme-modified));
}
.ab {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  font-size: 0.76rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: 12px;
}
.block {
  max-width: 860px;
  padding: 4px 0 16px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
.block:last-child {
  border-bottom: none;
}
h3 {
  margin: 8px 0 4px;
  font-size: 0.9rem;
  font-weight: 600;
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin: 8px 0;
}
.mode {
  max-width: 220px;
}
.picks {
  gap: 4px;
}
.files {
  max-height: 280px;
  overflow: auto;
  margin: 4px 0;
  padding: 4px 8px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.14);
  border-radius: 8px;
}
.path {
  font-size: 0.78rem;
}
.state {
  margin-left: 8px;
  font-size: 0.7rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.hint {
  margin: 6px 0;
  font-size: 0.82rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.hint.bad {
  color: rgb(var(--v-theme-error));
}
.hint.warn {
  color: rgb(var(--v-theme-warning));
}
.confirm-text {
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
