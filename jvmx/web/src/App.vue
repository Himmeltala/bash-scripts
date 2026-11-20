<template>
  <ToolApp
    title="jvmx"
    :api="api"
    storage-key="jvmx-ws"
    collapsed-key="jvmx-ws-collapsed"
    :extra-state="{ jdks: [], currentJdk: '' }"
    added-notice="已添加，正在列出目标"
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
        :jdks="state.jdks"
        :current-jdk="state.currentJdk"
        @start="startService"
        @stop="stopService"
        @save="saveService"
        @setjdk="setWorkspaceJdk($event, act, toast)"
        @scan="rescan"
        @forget="removeWorkspace"
        @notice="toast($event.text, $event.color)"
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
  hint: '填 Maven 或 Gradle 工程所在目录：Maven 会自动往上找 pom.xml，Gradle 找 settings.gradle。加了之后这里列出能启动、构建的模块。',
  action: '添加工作区',
  hintWidth: 460,
}

const listTexts = {
  addTip: '选 Maven 或 Gradle 工程所在的目录，加的时候会往上找 pom.xml 或 settings.gradle。',
  removeText: '登记的服务与日志一起删掉，正在跑的进程会先停掉。工程目录本身不动。',
}

async function loadExtra(snapshot) {
  const data = await api.jdks()
  snapshot.jdks = data.jdks || []
  snapshot.currentJdk = data.current || ''
}

async function setWorkspaceJdk({ ws, jdk }, act, toast) {
  const ok = await act('设置 JDK', () => api.setJdk(ws, jdk))
  if (ok) toast(jdk ? 'JDK 已设置，下次启动生效' : '已改为跟随当前环境', 'primary')
}
</script>
