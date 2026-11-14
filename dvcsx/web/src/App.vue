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

    <ToastHost v-model="snack.on" :text="snack.text" :color="snack.color" />

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
          <EmptyState
            v-else
            icon="mdi-source-branch"
            title="先加一个工作副本"
            hint="选一个 SVN 工作副本或 Git 仓库的目录，加了之后这里列出它的未提交变更、最近的提交日志，也能拉取、推送、切换分支、更新、提交和浏览目录看代码。"
            action="添加工作副本"
            @action="addWorkspace()"
          />
        </main>
      </div>
    </v-main>
  </v-app>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import WorkspaceList from './components/WorkspaceList.vue'
import WorkspacePanel from './components/WorkspacePanel.vue'
import { useThemeToggle } from '@bash-scripts/web-shared/theme'
import { EmptyState, ToastHost, useToast } from '@bash-scripts/web-shared/ui'
import { api, stateEventsUrl } from './composables/useApi'
import { rememberTheme } from './plugins/vuetify'

const VIEW_KEY = 'dvcsx-ws'

const { dark, toggle: toggleTheme } = useThemeToggle({ rememberTheme })
const state = reactive({ workspaces: [] })
const currentId = useLocalStorage(VIEW_KEY, '', { writeDefaults: false })
const adding = ref(false)
const { snack, toast } = useToast()

const current = computed(() => state.workspaces.find((w) => w.id === currentId.value) || null)
let source = null

function select(id) {
  currentId.value = id || ''
}

function applyState(data) {
  state.workspaces = data.workspaces || []
  // 没选中或选中的已经移出时，落到第一个；列表空着就清空选中。
  if (!currentId.value && state.workspaces.length) select(state.workspaces[0].id)
  else if (currentId.value && !current.value) select('')
}

async function refresh() {
  try {
    applyState(await api.state())
  } catch (err) {
    // 取不到就先留着现有列表，下一次推送再补。
  }
}

// 登记表一变就推过来，页面不用再定时来取。
function connectState() {
  source = new EventSource(stateEventsUrl())
  source.addEventListener('state', (ev) => {
    try {
      applyState(JSON.parse(ev.data))
    } catch (err) {
      // 单条坏了跳过，下一次推送再补。
    }
  })
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
  connectState()
  await refresh()
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
