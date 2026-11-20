<template>
  <v-app>
    <v-app-bar density="comfortable" flat border="b" class="app-bar">
      <v-app-bar-nav-icon
        :title="sideOpen ? '收起左侧列表' : '展开左侧列表'"
        @click="sideOpen = !sideOpen"
      />
      <v-app-bar-title>
        <span class="brand">dvcsx</span>
      </v-app-bar-title>
      <v-spacer />
      <Metrics :dark="dark" :metrics="metrics" />
      <v-btn
        :icon="dark ? 'mdi-weather-sunny' : 'mdi-weather-night'"
        variant="text"
        title="切换深浅色"
        @click="toggleTheme"
      />
      <v-btn icon="mdi-cog-outline" variant="text" title="设置" @click="settingsOpen = true" />
    </v-app-bar>

    <ToastHost v-model="snack.on" :text="snack.text" :color="snack.color" />
    <SettingsDialog v-model="settingsOpen" @saved="toast('设置已保存', 'success')" />

    <v-main class="fill-height">
      <div ref="shellRef" class="shell">
        <div
          class="side-slot"
          :style="{ width: sideOpen ? `${sideWidth}px` : '0px' }"
        />
        <div class="side-layer" :class="{ folded: !sideOpen }" :style="{ width: `${sideWidth}px` }">
          <aside class="side">
            <WorkspaceList
              :workspaces="state.workspaces"
              :groups="state.groups"
              :current="currentId"
              :busy="adding"
              @select="select"
              @add="addWorkspace"
              @remove="removeWorkspace"
              @changed="refresh"
              @groups-change="setGroups"
              @notice="toast($event.text, $event.color)"
            />
          </aside>
        </div>
        <SplitHandle
          v-show="sideOpen"
          axis="x"
          :active="resizing"
          @start="startSplit"
          @reset="resetSplit"
        />
        <main class="content">
          <div v-if="current" class="panelwrap">
            <WorkspacePanel :key="current.id" :ws="current" />
          </div>
          <EmptyState
            v-else
            icon="mdi-source-branch"
            title="先加一个工作副本"
            hint="选一个 SVN 工作副本、Git 仓库或普通目录，加了之后这里列出它的未提交变更、最近的提交日志，也能拉取、推送、切换分支、更新、提交和浏览目录看代码；普通目录只能浏览和编辑文件。"
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
import SettingsDialog from './components/SettingsDialog.vue'
import { useThemeToggle } from '@bash-scripts/web-shared/theme'
import { EmptyState } from '@bash-scripts/web-shared/layouts'
import { ToastHost } from '@bash-scripts/web-shared/feedbacks'
import { SplitHandle } from '@bash-scripts/web-shared/layouts'
import { useSplitPane } from '@bash-scripts/web-shared'
import { Metrics } from '@bash-scripts/web-shared/metrics'
import { api, metricsEventsUrl, stateEventsUrl } from './utils/api'
import { snack, toast } from './utils/notice'
import { rememberTheme } from './plugins/vuetify'

const VIEW_KEY = 'dvcsx-ws'

const { dark, toggle: toggleTheme } = useThemeToggle({ rememberTheme })
const state = reactive({ workspaces: [], groups: [] })
const currentId = useLocalStorage(VIEW_KEY, '', { writeDefaults: false })
const adding = ref(false)
const settingsOpen = ref(false)

// 左侧工作副本列表的宽度随分隔条拖动改变，双击分隔条还原；记在本地下次打开接着用。
const shellRef = ref(null)
// 左侧列表是否展开；用头部按钮收起，收起后正文占满。
const sideOpen = ref(true)
const { size: sideWidth, resizing, start: startSplit, reset: resetSplit } = useSplitPane({
  area: shellRef,
  initial: 268,
  min: 200,
  rightMin: 420,
  persist: 'dvcsx.shell.side-width',
})

const current = computed(() => state.workspaces.find((w) => w.id === currentId.value) || null)
// 头部性能指标：CPU、内存、磁盘与网速，单独一条推送。
const metrics = ref(null)
let source = null
let metricsSource = null

function select(id) {
  currentId.value = id || ''
}

// 分组结构先照着页面的改法摆上，存失败再退回服务端那一份。
async function setGroups(nodes) {
  const before = state.groups
  state.groups = nodes
  try {
    const data = await api.saveGroups(nodes)
    if (data && data.groups) state.groups = data.groups
  } catch (err) {
    state.groups = before
    toast(`保存分组失败：${err.message}`, 'error')
  }
}

function applyState(data) {
  state.workspaces = data.workspaces || []
  state.groups = data.groups || []
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

function connectMetrics() {
  metricsSource = new EventSource(metricsEventsUrl())
  metricsSource.addEventListener('metrics', (ev) => {
    try {
      metrics.value = JSON.parse(ev.data)
    } catch (err) {
      // 单条坏了跳过，下一份再补。
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
  connectMetrics()
  await refresh()
})

onBeforeUnmount(() => {
  if (source) source.close()
  if (metricsSource) metricsSource.close()
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
  position: relative;
  display: flex;
  height: calc(100vh - 64px);
  overflow: hidden;
}
/* 占位层跟着开关一次性改变宽度；侧栏本体绝对定位，靠 transform 滑出，不再逐帧重排正文。 */
.side-slot {
  flex: 0 0 auto;
}
.side-layer {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  z-index: 2;
  transition: transform 0.18s ease, opacity 0.14s ease;
}
.side-layer.folded {
  transform: translateX(-100%);
  opacity: 0;
  pointer-events: none;
}
.side {
  width: 100%;
  height: 100%;
  min-width: 0;
  background: rgb(var(--v-theme-surface));
  overflow: hidden auto;
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
</style>
