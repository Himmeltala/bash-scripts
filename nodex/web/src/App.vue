<template>
  <WorkspaceShell
    title="nodex"
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
  hint: '填 Node 工程里带 package.json 的目录，加了之后这里列出能启动、打包、安装的脚本。',
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
  storageKey: 'nodex-ws',
  extraState: { nodes: [], currentNode: '' },
  addedNotice: '已添加，正在列出脚本',
  loadExtra: async (snapshot) => {
    const data = await api.nodes()
    snapshot.nodes = data.nodes || []
    snapshot.currentNode = data.current || ''
  },
})

async function setWorkspaceNode({ ws, node }) {
  const ok = await act('设置 Node', () => api.setNode(ws, node))
  if (ok) toast(node ? 'Node 已设置，下次启动生效' : '已改为跟随当前环境', 'primary')
}

onMounted(start)
</script>
