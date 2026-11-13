<template>
  <WorkspaceList
    :workspaces="workspaces"
    :current="current"
    :busy="busy"
    :dirs="loadDirs"
    :save-alias="saveAlias"
    :texts="texts"
  >
    <template #title-extra="{ ws }">
      <v-chip size="x-small" variant="tonal" class="vcs">
        {{ ws.vcs === 'git' ? 'Git' : 'SVN' }}
      </v-chip>
    </template>
  </WorkspaceList>
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
  headTitle: '工作副本',
  empty: '还没有添加过工作副本',
  forgetTitle: '移出列表',
  addTitle: '添加工作副本',
  addTip: '选 SVN 工作副本或 Git 仓库所在的目录，加的时候会先确认这个目录在版本控制里。',
  addLabel: '工作副本目录',
  addPlaceholder: '~/pros/svn/省/项目/前端/仓库名',
  removeTitle: '移出列表',
  removeText: '只是不在这里显示，工作副本本身不动，也不会跑任何修改版本库或工作副本的命令。',
}
</script>

<style scoped>
.vcs {
  margin-left: 6px;
  vertical-align: middle;
}
</style>
