<template>
  <div class="branch">
    <div class="row" :class="{ excluded: node.excluded }" :style="{ paddingLeft: 4 + depth * 14 + 'px' }">
      <v-btn
        v-if="node.dir"
        icon
        size="x-small"
        variant="text"
        class="chev"
        :title="open ? '收起' : '展开'"
        @click.stop="$emit('toggle', node.rel)"
      >
        <v-icon size="16">{{ open ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
      </v-btn>
      <span v-else class="chev-space" />
      <v-icon size="16" :class="node.dir ? 'folder' : 'file'" :style="iconStyle">{{ icon }}</v-icon>
      <v-checkbox-btn
        class="pick"
        density="compact"
        :model-value="checked"
        :disabled="node.excluded || locked"
        @update:model-value="$emit('pick', node)"
      />
      <span class="label mono" :title="node.rel">{{ node.name }}</span>
      <span v-if="node.excluded" class="meta">默认排除</span>
      <span v-else-if="!node.dir && node.size" class="meta">{{ sizeText(node.size) }}</span>
    </div>

    <template v-if="node.dir && open">
      <p v-if="state.loading" class="hint">正在读取…</p>
      <p v-else-if="state.error" class="hint bad">{{ state.error }}</p>
      <p v-else-if="!state.entries.length" class="hint">空目录</p>
      <template v-else>
        <ZipTree
          v-for="child in state.entries"
          :key="child.rel"
          :node="child"
          :depth="depth + 1"
          :expanded="expanded"
          :cache="cache"
          :picked="picked"
          @toggle="$emit('toggle', $event)"
          @pick="$emit('pick', $event)"
        />
        <p v-if="state.truncated" class="hint">这一层太多，只列了前面一部分。</p>
      </template>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { fileIcon } from '../composables/fileIcons'
import { sizeText } from '../composables/format'

const props = defineProps({
  node: { type: Object, required: true },
  depth: { type: Number, default: 0 },
  expanded: { type: Object, required: true },
  cache: { type: Object, required: true },
  picked: { type: Array, required: true },
})

defineEmits(['toggle', 'pick'])

const open = computed(() => props.expanded[props.node.rel] === true)
const state = computed(
  () => props.cache[props.node.rel] || { loading: false, error: '', entries: [], truncated: false },
)
// 目录被勾中时它下面的条目也算在里面，显示成勾上但点不动。
const locked = computed(() =>
  props.picked.some((rel) => rel !== props.node.rel && props.node.rel.startsWith(`${rel}/`)),
)
const checked = computed(() => props.picked.includes(props.node.rel) || locked.value)

// 目录按展开状态换图标，文件按名字配类型图标与颜色。
const icon = computed(() => {
  if (props.node.dir) return open.value ? 'mdi-folder-open-outline' : 'mdi-folder-outline'
  return fileIcon(props.node.name).icon
})
const iconStyle = computed(() => {
  if (props.node.dir) return null
  const color = fileIcon(props.node.name).color
  return color ? { color } : null
})
</script>

<style scoped>
.branch {
  min-width: 0;
}
.row {
  display: flex;
  align-items: center;
  gap: 2px;
  min-height: 28px;
  padding-right: 12px;
  border-radius: 6px;
}
.row:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
}
.row.excluded {
  opacity: 0.45;
}
.chev {
  flex: 0 0 auto;
}
.chev-space {
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
.pick {
  flex: 0 0 auto;
  margin-inline: 2px;
}
.label {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 0.82rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.meta {
  flex: 0 0 auto;
  font-size: 0.7rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.hint {
  margin: 2px 0 2px 34px;
  font-size: 0.76rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.hint.bad {
  color: rgb(var(--v-theme-error));
}
</style>
