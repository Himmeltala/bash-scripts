<!--
 * @Author: Himmeltala
 * @Date: 2026-11-24 22:08:05
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-24 22:28:38
 * @FilePath: \idex\web\src\features\sync\components\SyncBar.vue
 * @Description: 源代码管理顶部的分支、拉取、推送与提交条，操作输出放在弹窗里。
-->
<template>
  <div class="syncbar">
    <div class="row head">
      <template v-if="isGit">
        <v-icon size="16">mdi-source-branch</v-icon>
        <span class="mono branch">{{ branchText }}</span>
        <span v-if="info.upstream" class="mono up">{{ info.upstream }}</span>
        <span v-if="info.ahead" class="ab" title="本地分支比远端多出的提交">
          <v-icon size="12">mdi-arrow-up-bold</v-icon>{{ info.ahead }}
        </span>
        <span v-if="info.behind" class="ab" title="远端比本地分支多出的提交">
          <v-icon size="12">mdi-arrow-down-bold</v-icon>{{ info.behind }}
        </span>
        <v-btn size="small" variant="text" :disabled="busy || !writable" @click="openBranch">
          切换分支
        </v-btn>
      </template>
      <template v-else>
        <span class="mono up">{{ info.url }}</span>
        <span v-if="info.revision" class="rev">r{{ info.revision }}</span>
      </template>
      <v-spacer />
      <v-btn
        v-if="isGit"
        size="small"
        variant="text"
        prepend-icon="mdi-cloud-download-outline"
        :loading="running === 'pull'"
        :disabled="busy || !writable || !info.upstream"
        @click="ask('pull')"
      >
        拉取
      </v-btn>
      <v-btn
        v-if="isGit"
        size="small"
        variant="text"
        prepend-icon="mdi-cloud-upload-outline"
        :loading="running === 'push'"
        :disabled="busy || !writable || info.detached || (!info.upstream && !(info.remotes && info.remotes.length))"
        @click="ask('push')"
      >
        推送
      </v-btn>
      <v-btn
        v-else
        size="small"
        variant="text"
        prepend-icon="mdi-cloud-download-outline"
        :loading="running === 'update'"
        :disabled="busy || !writable"
        @click="ask('update')"
      >
        更新
      </v-btn>
    </div>

    <div v-if="running" class="row status">
      <v-progress-circular size="14" width="2" indeterminate />
      <span class="hint">{{ actionLabel }}中…</span>
      <v-spacer />
      <v-btn size="small" variant="text" color="error" :loading="canceling" @click="cancel">
        取消
      </v-btn>
    </div>

    <p v-if="!writable" class="hint warn">
      当前页面不是从本机打开的，拉取、推送与提交已禁用；要放开给其他机器，用 --allow-write 启动。
    </p>

    <div class="row commit">
      <v-textarea
        v-model="message"
        label="提交说明"
        rows="2"
        density="compact"
        variant="outlined"
        hide-details
        :maxlength="8000"
        class="msg"
        @keydown.ctrl.enter.prevent="ask('commit')"
      />
      <div class="commit-side">
        <span v-if="isGit" class="hint">已暂存 {{ staged.length }} 项</span>
        <span v-else class="hint">已选 {{ picked.length }} 个</span>
        <v-btn
          color="primary"
          variant="flat"
          prepend-icon="mdi-source-commit"
          :loading="running === 'commit'"
          :disabled="commitDisabled"
          @click="ask('commit')"
        >
          提交
        </v-btn>
      </div>
    </div>
    <p v-if="conflicts.length" class="hint bad">有冲突：{{ conflicts.join('、') }}，先解决再提交。</p>

    <FloatingDialog
      v-model="confirm.on"
      :initial-width="520"
      :initial-height="280"
      :min-width="380"
      :min-height="200"
    >
      <template #title>{{ confirm.title }}</template>
      <p class="confirm-text">{{ confirm.text }}</p>
      <template #actions>
        <v-spacer />
        <v-btn variant="text" @click="confirm.on = false">取消</v-btn>
        <v-btn color="primary" variant="flat" @click="runPending">执行</v-btn>
      </template>
    </FloatingDialog>

    <FloatingDialog
      v-model="branch.on"
      :initial-width="520"
      :initial-height="300"
      :min-width="380"
      :min-height="220"
    >
      <template #title>切换分支</template>
      <v-select
        v-model="branch.pick"
        :items="branchItems"
        label="分支"
        density="compact"
        variant="outlined"
        hide-details
        class="mb-3"
      />
      <v-text-field
        v-model="branch.name"
        label="或新建分支"
        placeholder="从当前提交新建并切换"
        density="compact"
        variant="outlined"
        hide-details
      />
      <template #actions>
        <v-spacer />
        <v-btn variant="text" @click="branch.on = false">取消</v-btn>
        <v-btn color="primary" variant="flat" :disabled="!branchReady" @click="runBranch">
          执行
        </v-btn>
      </template>
    </FloatingDialog>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { FloatingDialog } from '@bash-scripts/web-shared/feedbacks'
import { api } from '../../../utils/api'
import { toast } from '../../../utils/notice'
import { useSyncJob } from '../composables/useSyncJob'
import {
  PULL_MODES,
  branchItemsOf,
  commitDisabledOf,
  committableOf,
  confirmTextOf,
  confirmTitleOf,
  findBranchOf,
} from '../lib/syncView'

const props = defineProps({
  ws: { type: Object, required: true },
  files: { type: Array, default: () => [] },
  staged: { type: Array, default: () => [] },
  refresh: { type: Number, default: 0 },
})
const emit = defineEmits(['done'])

const isGit = computed(() => props.ws.vcs === 'git')

const info = ref({})
const message = ref('')
const pullMode = ref('ff')
const checkoutBody = ref(null)
const picked = ref([])
const confirm = reactive({ on: false, title: '', text: '', action: '' })
const branch = reactive({ on: false, pick: '', name: '' })

const writable = computed(() => info.value.writable !== false)
const busy = computed(() => !!running.value)
const conflicts = computed(() =>
  props.files.filter((item) => item.item === 'conflicted').map((item) => item.path),
)
const pullModes = PULL_MODES
const branchItems = computed(() => branchItemsOf(info.value.branches))
const branchText = computed(() => {
  if (info.value.detached) return info.value.has_head ? '（游离 HEAD）' : '（还没有提交）'
  return info.value.branch || '—'
})
const branchReady = computed(() => !!(branch.name.trim() || branch.pick))

const committable = computed(() => committableOf(props.files, isGit.value))
const commitDisabled = computed(() =>
  commitDisabledOf({
    isGit: isGit.value,
    busy: busy.value,
    writable: writable.value,
    message: message.value,
    conflicts: conflicts.value,
    staged: props.staged,
    unstaged: props.files,
    picked: picked.value,
  }),
)

function bodyFor(action) {
  if (action === 'checkout') return checkoutBody.value || {}
  if (action === 'pull') return { mode: pullMode.value }
  if (action === 'push') return { set_upstream: !info.value.upstream }
  if (action === 'commit') {
    return isGit.value
      ? { message: message.value, stage_all: !props.staged.length }
      : { message: message.value, paths: picked.value }
  }
  return {}
}

const ACTION_LABEL = {
  pull: '拉取',
  push: '推送',
  update: '更新',
  commit: '提交',
  checkout: '切换分支',
}
const actionLabel = computed(() => ACTION_LABEL[running.value] || '操作')

const { running, output: outputText, lastError, canceling, start, cancel, dispose } = useSyncJob({
  wsId: () => props.ws.id,
  bodyFor,
  onFinish: (action, data) => {
    const name = ACTION_LABEL[action] || '操作'
    if (data && data.ok === false) {
      toast(`${name}失败：${data.error || '看服务端输出'}`, 'error', outputText.value)
    } else {
      if (action === 'commit') message.value = ''
      toast(`${name}完成`, 'primary')
    }
    loadInfo()
    emit('done')
  },
})

async function loadInfo() {
  try {
    info.value = await api.syncInfo(props.ws.id)
    if (!isGit.value) {
      picked.value = committable.value.map((item) => item.path)
    }
  } catch (err) {
    // 读不到就不显示分支与同步按钮，变更列表照常可用。
  }
}

async function runAction(action) {
  const ok = await start(action)
  if (!ok && lastError.value) toast(lastError.value, 'error')
}

function ask(action) {
  if (action !== 'commit') {
    runAction(action)
    return
  }
  confirm.action = action
  confirm.title = confirmTitleOf(action, null, isGit.value)
  confirm.text = confirmTextOf({
    pending: action,
    checkout: null,
    isGit: isGit.value,
    info: info.value,
    pullLabel: (pullModes.find((item) => item.value === pullMode.value) || {}).title || '',
    stageAllCommit: isGit.value && !props.staged.length,
    staged: props.staged,
    picked: picked.value,
    message: message.value,
  })
  confirm.on = true
}

async function runPending() {
  const action = confirm.action
  confirm.on = false
  await runAction(action)
}

function openBranch() {
  branch.pick = ''
  branch.name = ''
  branch.on = true
}

async function runBranch() {
  const name = branch.name.trim()
  const checkout = name
    ? { branch: name, create: true }
    : (() => {
        const found = findBranchOf(info.value.branches, branch.pick)
        if (!found) return null
        return found.remote
          ? { branch: found.start_point, start_point: found.start_point }
          : { branch: found.name }
      })()
  if (!checkout) return
  branch.on = false
  checkoutBody.value = checkout
  await runAction('checkout')
}

watch(
  () => props.refresh,
  () => loadInfo(),
)

// SVN 没有索引，提交路径默认跟着当前可提交的文件走。
watch(committable, (list) => {
  if (!isGit.value) picked.value = list.map((item) => item.path)
})

onMounted(loadInfo)
onBeforeUnmount(dispose)
</script>

<style scoped>
.syncbar {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px 12px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.head {
  flex-wrap: wrap;
}
.branch {
  font-weight: 600;
}
.up,
.ab,
.rev,
.hint {
  font-size: 0.78rem;
}
.up {
  color: rgb(var(--v-theme-on-surface-variant));
}
.ab {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  color: rgb(var(--v-theme-primary));
}
.bad {
  color: rgb(var(--v-theme-failed));
}
.warn {
  color: rgb(var(--v-theme-warning));
}
.commit {
  align-items: flex-start;
}
.msg {
  flex: 1 1 auto;
}
.commit-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex: 0 0 auto;
}
.confirm-text {
  white-space: pre-wrap;
}
</style>
