<template>
  <v-app>
    <v-app-bar density="comfortable" flat border="b" class="app-bar">
      <v-app-bar-title>
        <span class="brand">dvcsx</span>
      </v-app-bar-title>
      <v-spacer />
      <v-btn
        :icon="dark ? 'mdi-weather-sunny' : 'mdi-weather-night'"
        variant="text"
        title="切换深浅色"
        @click="toggleTheme"
      />
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
          <div v-if="current" class="panelwrap">
            <WorkspacePanel :key="current.id" :ws="current" />
          </div>
          <div v-else class="empty">
            <v-icon size="56" color="on-surface-variant">mdi-source-branch</v-icon>
            <p class="empty-title">先加一个工作副本</p>
            <p class="empty-hint">
              选一个 SVN 工作副本或 Git 仓库的目录，加了之后这里列出它的未提交变更、最近的提交日志，也能拉取、推送、更新、提交和浏览目录看代码。
            </p>
            <v-btn color="primary" variant="flat" prepend-icon="mdi-folder-plus" @click="addWorkspace()">
              添加工作副本
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
import WorkspacePanel from './components/WorkspacePanel.vue'
import { api } from './composables/useApi'
import { rememberTheme } from './plugins/vuetify'

const POLL_MS = 5000
const VIEW_KEY = 'dvcsx-ws'

const theme = useTheme()
const dark = computed(() => theme.global.current.value.dark)
const state = reactive({ workspaces: [] })
const currentId = useLocalStorage(VIEW_KEY, '', { writeDefaults: false })
const adding = ref(false)
const snack = reactive({ on: false, text: '', color: 'grey' })

const current = computed(() => state.workspaces.find((w) => w.id === currentId.value) || null)
let timer = null

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

async function refresh() {
  try {
    const data = await api.state()
    state.workspaces = data.workspaces || []
    // 没选中或选中的已经移出时，落到第一个；列表空着就清空选中。
    if (!currentId.value && state.workspaces.length) select(state.workspaces[0].id)
    else if (currentId.value && !current.value) select('')
  } catch (err) {
    // 轮询失败不打扰用户，下一次再试。
  }
}

async function addWorkspace(root) {
  const path = typeof root === 'string' ? root : ''
  adding.value = true
  try {
    const data = await api.addWorkspace(path)
    await refresh()
    if (data.workspace) select(data.workspace.id)
    toast('已添加', 'primary')
  } catch (err) {
    toast(`添加失败：${err.message}`, 'error')
  } finally {
    adding.value = false
  }
}

async function removeWorkspace(id) {
  try {
    await api.forgetWorkspace(id)
    if (currentId.value === id) select('')
    toast('已移出列表')
  } catch (err) {
    toast(`移出失败：${err.message}`, 'error')
  }
  await refresh()
}

onMounted(async () => {
  await refresh()
  timer = setInterval(() => {
    // 页面切到后台就不刷了，回来立刻补一次；只看登记列表，变更由子面板各自刷新。
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
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.panelwrap {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
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
  max-width: 460px;
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
  .content {
    height: calc(100vh - 64px);
  }
}
</style>
