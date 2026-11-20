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
      当前页面不是从本机打开的，拉取、推送、切换分支、更新与提交已禁用；要放开给其他机器，用 --allow-write 启动。
    </p>

    <div class="body">
      <section v-if="isGit" class="block">
        <h3>分支</h3>
        <p class="hint">
          切到本地分支，或从远端分支新建同名跟踪分支。工作区有未提交的改动且会被覆盖时，Git 会拒绝切换，原因显示在下面的输出里。
        </p>
        <div class="row">
          <v-select
            v-model="branchPick"
            :items="branchItems"
            label="切换分支"
            density="compact"
            hide-details
            class="branchsel"
          />
          <v-btn
            color="primary"
            prepend-icon="mdi-source-branch"
            :loading="running === 'checkout'"
            :disabled="busy || info.writable === false || !pickedBranch || pickedBranch.current"
            @click="askCheckout()"
          >
            切换
          </v-btn>
        </div>
        <div class="row">
          <v-text-field
            v-model="newBranch"
            label="新分支名"
            placeholder="从当前提交新建"
            density="compact"
            hide-details
            class="branchsel"
          />
          <v-btn
            color="primary"
            variant="tonal"
            prepend-icon="mdi-plus"
            :loading="running === 'checkout'"
            :disabled="busy || info.writable === false || !newBranch.trim() || newBranchTaken"
            @click="askCheckout(true)"
          >
            新建并切换
          </v-btn>
        </div>
        <p v-if="info.detached" class="hint warn">
          当前是游离 HEAD：切到已有分支可以回到分支上，新建分支会从当前提交起一个。
        </p>
      </section>

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
            填写提交说明，提交索引里已暂存的内容。未暂存的文件留在变更页，提交后仍然是改动。
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
        <template v-if="isGit">
          <div class="row picks">
            <span class="hint">已暂存 {{ staged.length }} 项</span>
          </div>
          <div class="files">
            <div v-for="item in staged" :key="item.path" class="staged-row">
              <span class="mono path">{{ item.path }}</span>
              <span class="state">{{ statusOf(item.item).text }}</span>
            </div>
            <p v-if="!staged.length" class="hint">索引里还没有内容，先到变更页暂存</p>
          </div>
        </template>
        <template v-else>
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
        </template>
        <p v-if="conflicts.length" class="hint bad">
          有冲突：{{ conflicts.join('、') }}。先解决冲突再提交。
        </p>
        <p v-if="missing.length" class="hint warn">
          本地缺失：{{ missing.join('、') }}。先 svn delete 再提交。
        </p>
        <v-btn
          color="primary"
          prepend-icon="mdi-source-commit"
          :loading="running === 'commit'"
          :disabled="commitDisabled"
          @click="ask('commit')"
        >
          提交
        </v-btn>
      </section>

      <section v-if="output" class="block">
        <h3>输出</h3>
        <LogView :text="output" :dark="dark" height="320px" />
      </section>
      <p v-if="lastError" class="hint bad">{{ lastError }}</p>
    </div>

    <FloatingDialog
      v-model="confirmOn"
      :initial-width="540"
      :initial-height="300"
      :min-width="400"
      :min-height="220"
    >
      <template #title>{{ confirmTitle }}</template>
      <p class="confirm-text">{{ confirmText }}</p>
      <p class="hint">执行后工作副本或远端会发生变化，请确认命令与目标都没问题。</p>
      <template #actions>
        <v-spacer />
        <v-btn variant="text" @click="confirmOn = false">取消</v-btn>
        <v-btn color="primary" variant="flat" :loading="!!running" @click="run">执行</v-btn>
      </template>
    </FloatingDialog>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useTheme } from 'vuetify'
import { FloatingDialog } from '@bash-scripts/web-shared/feedbacks'
import { LogView } from '@bash-scripts/web-shared'
import { api } from '../composables/useApi'
import { statusOf } from '../composables/format'
import {
  PULL_MODES,
  branchItemsOf,
  commitDisabledOf,
  committableOf,
  confirmTextOf,
  confirmTitleOf,
  findBranchOf,
  itemLabelOf,
  missingOf,
} from '../composables/syncView'
import { useSyncJob } from '../composables/useSyncJob'

const props = defineProps({
  ws: { type: Object, required: true },
  refresh: { type: Number, default: 0 },
})
const emit = defineEmits(['done'])

const theme = useTheme()
const dark = computed(() => theme.global.current.value.dark)

const info = ref({})
const loading = ref(false)
const error = ref('')
const pending = ref('')
// 索引为空时点提交要确认是否先把全部改动暂存再提交，点下按钮时记下这个选择。
const stageAllCommit = ref(false)
const confirmOn = ref(false)
const pullMode = ref('ff')
const setUpstream = ref(false)
const branchPick = ref('')
const newBranch = ref('')
const checkout = ref(null)
const message = ref('')
const picked = ref([])
const pickedInitialized = ref(false)
// 上次读同步信息的时间：操作刚结束时自己会读一次，紧跟的推送不必再读。
let loadedAt = 0

const pullModes = PULL_MODES

const isGit = computed(() => props.ws.vcs === 'git')

// 后台任务的启动、输出流、断线接回与取消交给组合式函数。
const {
  running,
  output,
  lastError,
  canceling,
  start: startJob,
  attachRunningJob,
  cancel: cancelJob,
  reset: resetJob,
  dispose: disposeJob,
} = useSyncJob({
  wsId: () => props.ws.id,
  bodyFor,
  onFinish,
})

const busy = computed(() => !!running.value)
// Git 可以把未跟踪文件加进来；SVN 的未纳管、缺失路径与两者的冲突都不能提交。
const committable = computed(() => committableOf(info.value.files, isGit.value))
const missing = computed(() => missingOf(info.value.files))
// Git 的提交只认索引：已暂存的条目只读展示，按钮按索引与冲突判断能不能点。
const staged = computed(() => (info.value.status && info.value.status.staged) || [])
const unstaged = computed(() => (info.value.status && info.value.status.unstaged) || [])
const conflicts = computed(() => info.value.conflicts || [])
const commitDisabled = computed(() =>
  commitDisabledOf({
    isGit: isGit.value,
    busy: busy.value,
    writable: info.value.writable,
    message: message.value,
    conflicts: conflicts.value,
    staged: staged.value,
    unstaged: unstaged.value,
    picked: picked.value,
  }),
)

function itemLabel(item) {
  return itemLabelOf(item, isGit.value)
}

const pullLabel = computed(
  () => pullModes.find((item) => item.value === pullMode.value)?.title || pullMode.value,
)

// 分支下拉：本地分支直接切，远端分支选中的是从远端新建同名跟踪分支。
const branches = computed(() => info.value.branches || [])
const branchItems = computed(() => branchItemsOf(branches.value))

function findBranch(value) {
  return findBranchOf(branches.value, value)
}

const pickedBranch = computed(() => findBranch(branchPick.value))
const newBranchTaken = computed(() =>
  branches.value.some((item) => !item.remote && item.name === newBranch.value.trim()),
)

function askCheckout(create = false) {
  if (create) {
    const name = newBranch.value.trim()
    if (!name) return
    checkout.value = { branch: name, create: true }
  } else {
    const item = pickedBranch.value
    if (!item || item.current) return
    checkout.value = item.remote
      ? { branch: item.name, start_point: item.start_point }
      : { branch: item.name }
  }
  pending.value = 'checkout'
  confirmOn.value = true
}

const confirmTitle = computed(() =>
  confirmTitleOf(pending.value, checkout.value, isGit.value),
)

const confirmText = computed(() =>
  confirmTextOf({
    pending: pending.value,
    checkout: checkout.value,
    isGit: isGit.value,
    info: info.value,
    pullLabel: pullLabel.value,
    stageAllCommit: stageAllCommit.value,
    staged: staged.value,
    picked: picked.value,
    message: message.value,
  }),
)

async function load() {
  loadedAt = Date.now()
  loading.value = true
  error.value = ''
  try {
    const data = await api.syncInfo(props.ws.id)
    // 下拉原来停在当前分支（或还没选）时，刷新后跟着新的当前分支走；用户自己选过的分支不抢。
    const oldCurrent = branches.value.find((item) => item.current)
    const followsCurrent =
      !branchPick.value || (oldCurrent && branchPick.value === `local:${oldCurrent.name}`)
    info.value = data
    const known = new Set(committable.value.map((item) => item.path))
    picked.value = picked.value.filter((path) => known.has(path))
    // 第一次打开提交页时把可提交的路径都勾上，之后保留用户自己的勾选。
    if (!pickedInitialized.value && known.size) {
      picked.value = [...known]
      pickedInitialized.value = true
    }
    if (followsCurrent || !findBranch(branchPick.value)) {
      const current = branches.value.find((item) => item.current)
      branchPick.value = current ? `local:${current.name}` : ''
    }
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
  attachRunningJob()
}

function pickAll() {
  picked.value = committable.value.map((item) => item.path)
}

function ask(action) {
  pending.value = action
  stageAllCommit.value = action === 'commit' && isGit.value && !staged.value.length
  confirmOn.value = true
}

// 启动任务时按当前的输入拼动作参数；Git 只提交索引，不再传 paths。
function bodyFor(action) {
  const body = {}
  if (action === 'checkout') Object.assign(body, checkout.value || {})
  if (action === 'pull') body.mode = pullMode.value
  if (action === 'push') body.set_upstream = setUpstream.value
  if (action === 'commit') {
    body.message = message.value
    if (isGit.value) {
      if (stageAllCommit.value) body.stage_all = true
    } else {
      body.paths = picked.value
    }
  }
  return body
}

// 任务收尾：提交后清空说明，切分支后清空选择，再通知外层并重读同步信息。
function onFinish(action) {
  if (action === 'commit') {
    message.value = ''
  } else if (action === 'checkout') {
    branchPick.value = ''
    newBranch.value = ''
  }
  emit('done', action)
  load()
}

async function run() {
  confirmOn.value = false
  if (!(await startJob(pending.value))) await load()
}

function reset() {
  resetJob()
  info.value = {}
  error.value = ''
  pending.value = ''
  stageAllCommit.value = false
  message.value = ''
  picked.value = []
  pickedInitialized.value = false
  setUpstream.value = false
  pullMode.value = 'ff'
  branchPick.value = ''
  newBranch.value = ''
  checkout.value = null
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
    if (busy.value) return
    // 任务刚结束那一会儿已经读过一次了，别为同一次变化再发一遍请求。
    if (Date.now() - loadedAt < 1000) return
    load()
  },
)
onMounted(load)
onBeforeUnmount(() => {
  disposeJob()
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
.branchsel {
  min-width: 220px;
  max-width: 340px;
}
.picks {
  gap: 4px;
}
.staged-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 0;
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
