<template>
  <v-app>
    <v-app-bar density="comfortable" flat border="b" class="app-bar">
      <v-app-bar-title>
        <span class="brand">nodex</span>
      </v-app-bar-title>
      <v-spacer />
      <v-chip
        v-if="state.workspaces.length"
        size="small"
        variant="tonal"
        class="running"
        :color="running ? 'ready' : undefined"
        prepend-icon="mdi-play-circle-outline"
        :title="running ? `所有工作区共 ${running} 个进程在跑` : '所有工作区都没有在跑的进程'"
      >
        {{ running }} 个在跑
      </v-chip>
      <Metrics :dark="dark" :metrics="metrics" />
      <v-btn :icon="dark ? 'mdi-weather-sunny' : 'mdi-weather-night'" variant="text" @click="toggleTheme" />
    </v-app-bar>

    <v-snackbar v-model="snack.on" :color="snack.color" timeout="4000" location="bottom right">
      {{ snack.text }}
    </v-snackbar>

    <v-main class="fill-height">
      <div class="shell">
        <aside class="side">
          <WorkspaceList
            :workspaces="state.workspaces"
            :current="currentId"
            :busy="adding"
            @select="select"
            @add="addWorkspace"
            @remove="removeWorkspace"
            @changed="refresh"
            @notice="toast($event.text, $event.color)"
          />
        </aside>
        <main class="content">
          <ServicePanel
            v-if="current"
            :ws="current"
            :dark="dark"
            :nodes="state.nodes"
            :current-node="state.currentNode"
            @start="startService"
            @stop="stopService"
            @save="saveService"
            @setnode="setWorkspaceNode"
            @scan="rescan"
            @forget="removeWorkspace"
            @notice="toast"
          />
          <div v-else class="empty">
            <v-icon size="56" color="on-surface-variant">mdi-view-dashboard-outline</v-icon>
            <p class="empty-title">先加一个工作区</p>
            <p class="empty-hint">填 Node 工程里带 package.json 的目录，加了之后这里列出能启动、打包、安装的脚本。</p>
            <v-btn color="primary" variant="flat" prepend-icon="mdi-folder-plus" @click="addWorkspace()">
              添加工作区
            </v-btn>
          </div>
        </main>
      </div>
    </v-main>
  </v-app>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { useTheme } from 'vuetify'
import WorkspaceList from './components/WorkspaceList.vue'
import ServicePanel from './components/ServicePanel.vue'
import { Metrics } from '@bash-scripts/web-shared/metrics'
import { api } from './composables/useApi'
import { runningCount } from './composables/format'
import { rememberTheme } from './plugins/vuetify'

const VIEW_KEY = 'nodex-ws'

const theme = useTheme()
const dark = computed(() => theme.global.current.value.dark)
const state = reactive({ workspaces: [], nodes: [], currentNode: '' })
const currentId = useLocalStorage(VIEW_KEY, '', { writeDefaults: false })
const adding = ref(false)
const snack = reactive({ on: false, text: '', color: 'grey' })
const metrics = ref(null)

const current = computed(() => state.workspaces.find((w) => w.id === currentId.value) || null)
const running = computed(() => state.workspaces.reduce((sum, ws) => sum + runningCount(ws), 0))
let source = null
let busy = 0

function select(id) {
  currentId.value = id || ''
}

function toast(text, color = 'grey') {
  snack.text = text
  snack.color = color
  snack.on = true
}

function toggleTheme() {
  const next = dark.value ? 'light' : 'dark'
  theme.global.name.value = next
  rememberTheme(next)
}

function applyState(data) {
  state.workspaces = data.workspaces || []
  if (currentId.value && !current.value) select('')
}

async function refresh() {
  if (busy) return
  try {
    applyState(await api.state())
  } catch (err) {
    // 取不到就先留着现有列表，下一次推送再补。
  }
}

// 状态与头部指标共用一条连接，页面不再自己轮询。
function connectState() {
  source = new EventSource(api.stateStreamUrl())
  source.addEventListener('state', (ev) => {
    // 动作进行中就别画，免得把中间态当成结果。
    if (busy) return
    try {
      applyState(JSON.parse(ev.data))
    } catch (err) {
      // 单条坏了跳过，下一次推送再补。
    }
  })
  source.addEventListener('metrics', (ev) => {
    if (document.hidden) return
    try {
      metrics.value = JSON.parse(ev.data)
    } catch (err) {
    }
  })
}

async function loadNodes() {
  try {
    const data = await api.nodes()
    state.nodes = data.nodes || []
    state.currentNode = data.current || ''
  } catch (err) {
    // 取不到只是下拉里没有候选，手动填路径仍然可用。
  }
}

async function act(label, fn) {
  busy += 1
  try {
    return await fn()
  } catch (err) {
    toast(`${label}失败：${err.message}`, 'error')
    return null
  } finally {
    busy -= 1
    refresh()
  }
}

async function addWorkspace(root) {
  const path = typeof root === 'string' ? root : ''
  adding.value = true
  const ok = await act('添加工作区', async () => {
    await api.addWorkspace(path)
    return true
  })
  adding.value = false
  if (!ok) return
  // 目录加来加去可能落到已有的工作区上，按目录重新找选中项。
  await refresh()
  const hit = state.workspaces.find((w) => w.root === path || w.root === path.replace(/\/+$/, ''))
  if (hit) select(hit.id)
  toast('已添加，正在列出脚本', 'primary')
}

async function removeWorkspace(id) {
  const ok = await act('移出工作区', async () => {
    await api.forgetWorkspace(id)
    return true
  })
  if (ok) {
    if (currentId.value === id) select('')
    toast('已移出，在跑的进程一并停了')
  }
}

async function rescan() {
  if (!current.value) return
  await act('重新扫描', () => api.rescan(current.value.id))
}

async function startService(payload) {
  const ok = await act('启动', () => api.start(payload))
  if (ok) toast('已发出启动', 'primary')
}

async function stopService(run) {
  const ok = await act('停止', () => api.stop(run))
  if (ok) toast('已停止')
}

async function saveService({ svc, args }) {
  const ok = await act('保存参数', () => api.update(svc, args))
  if (ok) toast('参数已保存', 'primary')
}

async function setWorkspaceNode({ ws, node }) {
  const ok = await act('设置 Node', () => api.setNode(ws, node))
  if (ok) toast(node ? 'Node 已设置，下次启动生效' : '已改为跟随当前环境', 'primary')
}

onMounted(async () => {
  connectState()
  await refresh()
  loadNodes()
})

onBeforeUnmount(() => {
  if (source) source.close()
})
</script>

<style scoped>
.app-bar {
  background: rgb(var(--v-theme-surface));
}
.brand {
  font-weight: 600;
  letter-spacing: 0.02em;
}
.running {
  margin-right: 10px;
}
.shell {
  display: flex;
  height: calc(100vh - 64px);
  overflow: hidden;
}
.side {
  width: 268px;
  flex: 0 0 268px;
  border-right: 1px solid rgba(128, 128, 128, 0.22);
  background: rgb(var(--v-theme-surface));
  overflow-y: auto;
}
.content {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}
.empty {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-align: center;
  padding: 24px;
}
.empty-title {
  font-size: 1.1rem;
  margin: 8px 0 0;
}
.empty-hint {
  color: rgb(var(--v-theme-on-surface-variant));
  max-width: 420px;
  margin: 0 0 12px;
}
@media (max-width: 720px) {
  .shell {
    flex-direction: column;
    height: auto;
  }
  .side {
    width: 100%;
    flex: 0 0 auto;
    border-right: none;
    border-bottom: 1px solid rgba(128, 128, 128, 0.22);
  }
}
</style>
