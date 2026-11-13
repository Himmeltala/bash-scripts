<template>
  <div class="branch">
    <div
      class="row"
      :class="{ selected: node.type === 'file' && node.path === selected }"
      :style="{ paddingLeft: 4 + depth * 14 + 'px' }"
      @click="clickRow"
    >
      <v-btn
        v-if="node.type === 'dir'"
        icon
        size="x-small"
        variant="text"
        class="arrow"
        :title="open ? '收起' : '展开'"
        @click.stop="$emit('toggle', node.path)"
      >
        <v-icon size="16">{{ open ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
      </v-btn>
      <span v-else class="arrow-space" />
      <v-icon
        size="16"
        :class="node.type === 'dir' ? 'folder' : 'file'"
        :style="file && file.color ? { color: file.color } : null"
      >
        {{ icon }}
      </v-icon>
      <span class="label" :title="node.path">{{ node.name }}</span>
    </div>

    <template v-if="node.type === 'dir' && open">
      <p v-if="state.loading" class="hint">正在读取…</p>
      <p v-else-if="state.error" class="hint bad">{{ state.error }}</p>
      <p v-else-if="!state.entries.length" class="hint">空目录</p>
      <template v-else>
        <BrowseTree
          v-for="child in state.entries"
          :key="child.path"
          :node="child"
          :depth="depth + 1"
          :expanded="expanded"
          :cache="cache"
          :selected="selected"
          @toggle="$emit('toggle', $event)"
          @pick="$emit('pick', $event)"
        />
        <p v-if="state.truncated" class="hint">这一层文件太多，只列了前面一部分。</p>
      </template>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { fileIcon } from '@bash-scripts/web-shared'

const props = defineProps({
  node: { type: Object, required: true },
  depth: { type: Number, default: 0 },
  expanded: { type: Object, required: true },
  cache: { type: Object, required: true },
  selected: { type: String, default: '' },
})

const emit = defineEmits(['toggle', 'pick'])

const open = computed(() => props.expanded[props.node.path] === true)
const state = computed(
  () => props.cache[props.node.path] || { loading: false, error: '', entries: [], truncated: false },
)
// 目录按展开状态换图标，文件按名字配类型图标与颜色。
const file = computed(() => (props.node.type === 'file' ? fileIcon(props.node.name) : null))
const icon = computed(() => {
  if (props.node.type === 'dir') return open.value ? 'mdi-folder-open-outline' : 'mdi-folder-outline'
  return file.value.icon
})

function clickRow() {
  if (props.node.type === 'dir') emit('toggle', props.node.path)
  else emit('pick', props.node)
}
</script>

<style scoped>
.row {
  display: flex;
  align-items: center;
  gap: 2px;
  min-height: 28px;
  padding-right: 8px;
  border-radius: 6px;
  cursor: pointer;
}
.row:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
}
.row.selected {
  background: rgba(var(--v-theme-primary), 0.14);
}
.arrow {
  flex: 0 0 auto;
}
.arrow-space {
  flex: 0 0 32px;
}
.folder {
  color: rgb(var(--v-theme-primary));
  flex: 0 0 auto;
}
.file {
  color: rgb(var(--v-theme-on-surface-variant));
  flex: 0 0 auto;
}
.label {
  font-size: 0.84rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hint {
  margin: 2px 0 2px 30px;
  font-size: 0.76rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.hint.bad {
  color: rgb(var(--v-theme-error));
}
</style>
