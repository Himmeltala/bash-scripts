<template>
  <ToolApp
    title="nodex"
    :api="api"
    storage-key="nodex-ws"
    collapsed-key="nodex-ws-collapsed"
    :extra-state="{ nodes: [], currentNode: '' }"
    added-notice="已添加，正在列出脚本"
    :empty="empty"
    :remember-theme="rememberTheme"
    :load-extra="loadExtra"
    :list-texts="listTexts"
  >
    <template
      #panel="{
        ws,
        state,
        dark,
        toast,
        act,
        startService,
        stopService,
        saveService,
        rescan,
        removeWorkspace,
      }"
    >
      <ServicePanel
        :ws="ws"
        :dark="dark"
        :nodes="state.nodes"
        :current-node="state.currentNode"
        @start="startService"
        @stop="stopService"
        @save="saveService"
        @setnode="setWorkspaceNode($event, act, toast)"
        @scan="rescan"
        @forget="removeWorkspace"
        @notice="toast"
      />
    </template>
  </ToolApp>
</template>

<script setup>
import { ToolApp } from '@bash-scripts/web-shared'
import ServicePanel from './components/ServicePanel.vue'
import { api } from './composables/useApi'
import { rememberTheme } from './plugins/vuetify'

const empty = {
  icon: 'mdi-view-dashboard-outline',
  title: '先加一个工作区',
  hint: '填 Node 工程里带 package.json 的目录，加了之后这里列出能启动、打包、安装的脚本。',
  action: '添加工作区',
  hintWidth: 420,
}

const listTexts = {
  addTip: '选 Node 工程所在的目录，加的时候会自动往上找声明了工作区的 package.json。',
  removeText: '登记的服务与日志一起删掉，正在跑的进程会先停掉。工程目录本身不动。',
}

async function loadExtra(snapshot) {
  const data = await api.nodes()
  snapshot.nodes = data.nodes || []
  snapshot.currentNode = data.current || ''
}

async function setWorkspaceNode({ ws, node }, act, toast) {
  const ok = await act('设置 Node', () => api.setNode(ws, node))
  if (ok) toast(node ? 'Node 已设置，下次启动生效' : '已改为跟随当前环境', 'primary')
}
</script>
