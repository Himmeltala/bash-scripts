<template>
  <WorkspaceShell
    :title="title"
    :workspaces="state.workspaces"
    :current="current"
    :running="running"
    :dark="dark"
    :snack="snack"
    :empty="empty"
    :toggle-theme="toggleTheme"
    @empty-action="addWorkspace()"
    @select-workspace="select"
  >
    <template #sidebar>
      <WorkspaceList
        :workspaces="state.workspaces"
        :groups="state.groups"
        :current="currentId"
        :busy="adding"
        :dirs="api.dirs"
        :save-alias="api.setAlias"
        :texts="listTexts"
        :storage-key="collapsedKey"
        @select="select"
        @add="addWorkspace"
        @remove="removeWorkspace"
        @changed="refresh"
        @groups-change="setGroups"
        @notice="toast($event.text, $event.color)"
      />
    </template>

    <template #metrics>
      <Metrics :dark="dark" :metrics="metrics" />
    </template>

    <template #default="{ ws }">
      <slot
        v-if="ws"
        name="panel"
        :ws="ws"
        :state="state"
        :dark="dark"
        :toast="toast"
        :act="act"
        :start-service="startService"
        :stop-service="stopService"
        :save-service="saveService"
        :rescan="rescan"
        :remove-workspace="removeWorkspace"
        :refresh="refresh"
      />
    </template>
  </WorkspaceShell>
</template>

<script setup>
import { onMounted } from 'vue'
import WorkspaceShell from './WorkspaceShell.vue'
import WorkspaceList from './WorkspaceList.vue'
import { Metrics } from '../commons/Metrics/index.js'
import { useThemeToggle } from '../../theme.js'
import { useWorkspaceState } from '../../composables/services/useWorkspaceState.js'

const props = defineProps({
  title: { type: String, required: true },
  // 工作区类工具的公共接口表，由 createToolApi 生成。
  api: { type: Object, required: true },
  empty: { type: Object, default: () => ({}) },
  // 工具的主题插件给的 rememberTheme，切换深浅色时把选择记在本地。
  rememberTheme: { type: Function, default: null },
  // 当前工作区 id 记在哪个本地键下。
  storageKey: { type: String, required: true },
  extraState: { type: Object, default: () => ({}) },
  addedNotice: { type: String, default: '已添加' },
  loadExtra: { type: Function, default: null },
  listTexts: { type: Object, default: () => ({}) },
  // 左侧分组收起状态记在哪个本地键下。
  collapsedKey: { type: String, default: '' },
})

const { dark, toggle: toggleTheme } = useThemeToggle({ rememberTheme: props.rememberTheme })

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
  setGroups,
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
  api: props.api,
  storageKey: props.storageKey,
  extraState: props.extraState,
  addedNotice: props.addedNotice,
  loadExtra: props.loadExtra,
})

onMounted(start)
</script>
