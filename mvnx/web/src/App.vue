<template>
  <WorkspaceShell
    title="mvnx"
    :workspaces="state.workspaces"
    :current="current"
    :running="running"
    :dark="dark"
    :snack="snack"
    :empty="empty"
    :toggle-theme="toggleTheme"
    @empty-action="addWorkspace()"
  >
    <template #sidebar>
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
    </template>

    <template #metrics>
      <Metrics :dark="dark" :metrics="metrics" />
    </template>

    <template #default="{ ws }">
      <ServicePanel
        v-if="ws"
        :ws="ws"
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
    </template>
  </WorkspaceShell>
</template>

<script setup>
import { onMounted } from 'vue'
import WorkspaceList from './components/WorkspaceList.vue'
import ServicePanel from './components/ServicePanel.vue'
import { Metrics } from '@bash-scripts/web-shared/metrics'
import { useThemeToggle } from '@bash-scripts/web-shared/theme'
import { WorkspaceShell, useWorkspaceState } from '@bash-scripts/web-shared'
import { api } from './composables/useApi'
import { rememberTheme } from './plugins/vuetify'

const { dark, toggle: toggleTheme } = useThemeToggle({ rememberTheme })

const empty = {
  icon: 'mdi-view-dashboard-outline',
  title: '先加一个工作区',
  hint: '填 Maven 工程里带 pom.xml 的目录，加了之后这里列出能启动、打包、安装的模块。',
  action: '添加工作区',
  hintWidth: 420,
}

const {
  state,
  current,
  currentId,
  adding,
  snack,
  toast,
  metrics,
  running,
  select,
  refresh,
  act,
  start,
  addWorkspace,
  removeWorkspace,
  rescan,
  startService,
  stopService,
  saveService,
} = useWorkspaceState({
  api,
  storageKey: 'mvnx-ws',
  extraState: { jdks: [], currentJdk: '' },
  addedNotice: '已添加，正在列出模块',
  loadExtra: async (snapshot) => {
    const data = await api.jdks()
    snapshot.jdks = data.jdks || []
    snapshot.currentJdk = data.current || ''
  },
})

async function setWorkspaceJdk({ ws, jdk }) {
  const ok = await act('设置 JDK', () => api.setJdk(ws, jdk))
  if (ok) toast(jdk ? 'JDK 已设置，下次启动生效' : '已改为跟随当前环境', 'primary')
}

onMounted(start)
</script>
