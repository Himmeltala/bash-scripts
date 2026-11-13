<template>
  <div class="branch">
    <div
      class="row"
      :class="[rowClass ? rowClass(node) : null, { clickable: pickOnRowClick }]"
      :style="{ paddingLeft: 4 + depth * 14 + 'px' }"
      @click="onRowClick"
    >
      <v-btn
        v-if="isDir"
        icon
        size="x-small"
        variant="text"
        class="arrow"
        :title="open ? '收起' : '展开'"
        @click.stop="emit('toggle', key)"
      >
        <v-icon size="16">{{ open ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
      </v-btn>
      <span v-else class="arrow-space" />
      <v-icon size="16" :class="isDir ? 'folder' : 'file'" :style="iconStyle">
        {{ icon }}
      </v-icon>
      <slot name="row-before-label" :node="node" :open="open" :state="state" />
      <span class="label" :class="labelClass" :title="key">{{ nameOf(node) }}</span>
      <slot name="row-after-label" :node="node" :open="open" :state="state" />
    </div>

    <template v-if="isDir && open">
      <p v-if="state.loading" class="hint">{{ text.loading }}</p>
      <p v-else-if="state.error" class="hint bad">{{ state.error }}</p>
      <p v-else-if="!state.entries.length" class="hint">{{ text.empty }}</p>
      <template v-else>
        <FileTreeNode
          v-for="child in state.entries"
          :key="keyOf(child)"
          :node="child"
          :depth="depth + 1"
          :expanded="expanded"
          :cache="cache"
          :key-of="keyOf"
          :dir-of="dirOf"
          :name-of="nameOf"
          :label-class="labelClass"
          :row-class="rowClass"
          :pick-on-row-click="pickOnRowClick"
          :texts="texts"
          @toggle="emit('toggle', $event)"
          @pick="emit('pick', $event)"
        >
          <template #row-before-label="scope">
            <slot name="row-before-label" v-bind="scope" />
          </template>
          <template #row-after-label="scope">
            <slot name="row-after-label" v-bind="scope" />
          </template>
        </FileTreeNode>
        <p v-if="state.truncated" class="hint">{{ text.truncated }}</p>
      </template>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { fileIcon } from '../utils/fileIcons.js'

const props = defineProps({
  node: { type: Object, required: true },
  depth: { type: Number, default: 0 },
  expanded: { type: Object, required: true },
  cache: { type: Object, required: true },
  keyOf: { type: Function, required: true },
  dirOf: { type: Function, required: true },
  nameOf: { type: Function, required: true },
  labelClass: { type: String, default: '' },
  rowClass: { type: Function, default: null },
  pickOnRowClick: { type: Boolean, default: false },
  texts: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['toggle', 'pick'])

// 每层的提示文案由调用方给，这里只兜底。
const DEFAULTS = {
  loading: '正在读取…',
  empty: '空目录',
  truncated: '这一层文件太多，只列了前面一部分。',
}
const text = computed(() => ({ ...DEFAULTS, ...props.texts }))
const EMPTY = { loading: false, error: '', entries: [], truncated: false }

const key = computed(() => props.keyOf(props.node))
const isDir = computed(() => props.dirOf(props.node))
const open = computed(() => props.expanded[key.value] === true)
const state = computed(() => props.cache[key.value] || EMPTY)

const file = computed(() => (isDir.value ? null : fileIcon(props.nameOf(props.node))))
const icon = computed(() => {
  if (isDir.value) return open.value ? 'mdi-folder-open-outline' : 'mdi-folder-outline'
  return file.value.icon
})
const iconStyle = computed(() => {
  if (isDir.value) return null
  return file.value.color ? { color: file.value.color } : null
})

function onRowClick() {
  // 只有调用方允许整行响应时才处理：压缩树只认复选框，浏览树整行都能点。
  if (!props.pickOnRowClick) return
  if (isDir.value) emit('toggle', key.value)
  else emit('pick', props.node)
}
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
  padding-right: 8px;
  border-radius: 6px;
}
.row:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
}
.row.clickable {
  cursor: pointer;
}
.row.selected {
  background: rgba(var(--v-theme-primary), 0.14);
}
.row.excluded {
  opacity: 0.45;
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
  flex: 1 1 auto;
  min-width: 0;
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
