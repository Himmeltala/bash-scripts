<template>
  <WorkspaceList
    :workspaces="workspaces"
    :current="current"
    :busy="busy"
    :groups="groups"
    :dirs="loadDirs"
    :save-alias="saveAlias"
    :texts="texts"
    storage-key="jvmx-ws-collapsed"
    @groups-change="$emit('groups-change', $event)"
  />
</template>

<script setup>
import { WorkspaceList } from '@bash-scripts/web-shared'
import { api } from '../composables/useApi'

defineProps({
  workspaces: { type: Array, required: true },
  current: { type: String, default: '' },
  busy: { type: Boolean, default: false },
  groups: { type: Array, default: () => [] },
})

defineEmits(['groups-change'])

const loadDirs = (path) => api.dirs(path)
const saveAlias = (id, alias) => api.setAlias(id, alias)
const texts = {
  addTip: '选 Maven 或 Gradle 工程所在的目录，加的时候会往上找 pom.xml 或 settings.gradle。',
  removeText: '登记的服务与日志一起删掉，正在跑的进程会先停掉。工程目录本身不动。',
}
</script>
