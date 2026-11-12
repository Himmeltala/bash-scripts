<template>
  <v-app>
    <v-app-bar density="comfortable" flat border="b" class="app-bar">
      <v-app-bar-title>
        <span class="brand">mvnx</span>
      </v-app-bar-title>
      <v-spacer />
      <SystemMonitor :dark="dark" />
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
            :jdks="state.jdks"
            :current-jdk="state.currentJdk"
            @start="startService"
            @stop="stopService"
            @save="saveService"
            @setjdk="setWorkspaceJdk"
            @scan="rescan"
            @forget="removeWorkspace"
          />
          <div v-else class="empty">
            <v-icon size="56" color="on-surface-variant">mdi-view-dashboard-outline</v-icon>
            <p class="empty-title">先加一个工作区</p>
            <p class="empty-hint">填 Maven 工程里带 pom.xml 的目录，加了之后这里列出能启动、打包、安装的模块。</p>
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
import SystemMonitor from './components/SystemMonitor.vue'
import { api } from './composables/useApi'
import { rememberTheme } from './plugins/vuetify'

const POLL_MS = 2000
const VIEW_KEY = 'mvnx-ws'

const theme = useTheme()
const dark = computed(() => theme.global.current.value.dark)
const state = reactive({ workspaces: [], jdks: [], currentJdk: '' })
const currentId = useLocalStorage(VIEW_KEY, '', { writeDefaults: false })
const adding = ref(false)
const snack = reactive({ on: false, text: '', color: 'grey' })

const current = computed(() => state.workspaces.find((w) => w.id === currentId.value) || null)
let timer = null
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

// 轮询与动作共用一条，动作进行中就别再拉，免得把中间态画到页面上。
async function refresh() {
  if (busy) return
  try {
    const data = await api.state()
    state.workspaces = data.workspaces || []
    if (currentId.value && !current.value) select('')
  } catch (err) {
    // 轮询失败不打扰用户，下一次再试。
  }
}

async function loadJdks() {
  try {
    const data = await api.jdks()
    state.jdks = data.jdks || []
    state.currentJdk = data.current || ''
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
  toast('已添加，正在列出模块', 'primary')
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

async function saveService({ svc, module, args }) {
  const ok = await act('保存参数', () => api.update(svc, module, args))
  if (ok) toast('参数已保存', 'primary')
}

async function setWorkspaceJdk({ ws, jdk }) {
  const ok = await act('设置 JDK', () => api.setJdk(ws, jdk))
  if (ok) toast(jdk ? 'JDK 已设置，下次启动生效' : '已改为跟随当前环境', 'primary')
}

onMounted(async () => {
  await refresh()
  loadJdks()
  timer = setInterval(() => {
    // 页面切到后台就不刷了，回来立刻补一次。
    if (!document.hidden) refresh()
  }, POLL_MS)
  document.addEventListener('visibilitychange', onVisible)
})

onBeforeUnmount(() => {
  clearInterval(timer)
  document.removeEventListener('visibilitychange', onVisible)
})

function onVisible() {
  if (!document.hidden) refresh()
}
</script>

<style scoped>
.app-bar {
  background: rgb(var(--v-theme-surface));
}
.brand {
  font-weight: 600;
  letter-spacing: 0.02em;
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
  overflow-y: auto;
}
.empty {
  height: 100%;
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
