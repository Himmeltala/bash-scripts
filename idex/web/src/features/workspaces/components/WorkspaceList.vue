<template>
  <WorkspaceList
    :workspaces="workspaces"
    :current="current"
    :busy="busy"
    :groups="groups"
    :dirs="loadDirs"
    :save-alias="saveAlias"
    :texts="texts"
    storage-key="idex-ws-collapsed"
    @groups-change="$emit('groups-change', $event)"
  >
    <template #title-extra="{ ws }">
      <v-icon
        size="14"
        class="vcs"
        :title="ws.vcs === 'git' ? 'Git 仓库' : ws.vcs === 'svn' ? 'SVN 工作副本' : '普通目录'"
      >
        {{
          ws.vcs === 'git'
            ? 'mdi-git'
            : ws.vcs === 'svn'
              ? 'mdi-source-repository'
              : 'mdi-folder-outline'
        }}
      </v-icon>
    </template>
  </WorkspaceList>
</template>

<script setup>
import { WorkspaceList } from '@bash-scripts/web-shared'
import { api } from '../../../utils/api'

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
  headTitle: '工作副本',
  empty: '还没有添加过工作副本',
  forgetTitle: '移出列表',
  addTitle: '添加工作副本',
  addTip: '选 SVN 工作副本、Git 仓库或普通目录；普通目录只能浏览和编辑文件。',
  addLabel: '工作副本目录',
  addPlaceholder: '~/pros/svn/省/项目/前端/仓库名',
  removeTitle: '移出列表',
  removeText: '只是不在这里显示，工作副本本身不动，也不会跑任何修改版本库或工作副本的命令。',
}
</script>

<style scoped>
.vcs {
  flex: 0 0 auto;
  opacity: 0.65;
}
</style>
