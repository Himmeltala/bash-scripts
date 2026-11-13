<template>
  <WorkspaceList
    :workspaces="workspaces"
    :current="current"
    :busy="busy"
    :dirs="loadDirs"
    :save-alias="saveAlias"
    :texts="texts"
  />
</template>

<script setup>
import { WorkspaceList } from '@bash-scripts/web-shared'
import { api } from '../composables/useApi'

defineProps({
  workspaces: { type: Array, required: true },
  current: { type: String, default: '' },
  busy: { type: Boolean, default: false },
})

const loadDirs = (path) => api.dirs(path)
const saveAlias = (id, alias) => api.setAlias(id, alias)
const texts = {
  addTip: '选 Node 工程所在的目录，加的时候会自动往上找声明了工作区的 package.json。',
}
</script>
