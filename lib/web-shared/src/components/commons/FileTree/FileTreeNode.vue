<template>
  <div class="branch">
    <div
      class="row"
      :class="[rowClass ? rowClass(node) : null, { clickable: pickOnRowClick, 'drag-over': dragOver }]"
      :data-path="key"
      :data-type="node.type"
      :style="{ paddingLeft: 4 + depth * 18 + 'px' }"
      :draggable="movable && dragReady"
      @click="onRowClick"
      @contextmenu.prevent.stop="onContext"
      @pointerdown="onPointerDown"
      @pointerup="cancelHold"
      @pointercancel="cancelHold"
      @dragstart="onDragStart"
      @dragend="onDragEnd"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
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
      <!-- 目录正在读这一层时，用转圈顶替文件夹图标，读完自动复原。 -->
      <v-progress-circular
        v-if="isDir && open && state.loading"
        indeterminate
        :size="14"
        :width="2"
        class="spin"
      />
      <v-icon v-else size="16" :class="isDir ? 'folder' : 'file'" :style="iconStyle">
        {{ icon }}
      </v-icon>
      <slot name="row-before-label" :node="node" :open="open" :state="state" />
      <span class="label" :class="labelClass">{{ nameOf(node) }}</span>
      <slot name="row-after-label" :node="node" :open="open" :state="state" />
    </div>

    <template v-if="isDir && open">
      <p v-if="state.error" class="hint bad">{{ state.error }}</p>
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
          :movable="movable"
          @toggle="emit('toggle', $event)"
          @pick="emit('pick', $event)"
          @context="emit('context', $event)"
          @drag-start="emit('drag-start', $event)"
          @drag-end="emit('drag-end')"
          @drop-on="emit('drop-on', $event)"
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
import { computed, ref } from 'vue'
import { fileIcon } from '../../../utils/commons/fileIcons.js'

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
  // 长按后可拖到别的目录：按住一段时间才开启原生拖动，避免误拖。
  movable: { type: Boolean, default: false },
  texts: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['toggle', 'pick', 'context', 'drag-start', 'drag-end', 'drop-on'])

// 每层的提示文案由调用方给，这里只兜底。
const DEFAULTS = {
  truncated: '这一层文件太多，只列了前面一部分。',
}
const text = computed(() => ({ ...DEFAULTS, ...props.texts }))
const EMPTY = { loading: false, error: '', entries: [], truncated: false }

const key = computed(() => props.keyOf(props.node))
const isDir = computed(() => props.dirOf(props.node))

// 长按 350ms 才开启原生拖动，避免点选、右键时误触。
const dragReady = ref(false)
const dragOver = ref(false)
let holdTimer = 0

function onPointerDown(event) {
  if (!props.movable || (event.button && event.button > 0)) return
  cancelHold()
  holdTimer = setTimeout(() => { dragReady.value = true }, 350)
}

function cancelHold() {
  clearTimeout(holdTimer)
  holdTimer = 0
}

function onDragStart(event) {
  if (!props.movable || !dragReady.value) {
    event.preventDefault()
    return
  }
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', String(props.key))
  emit('drag-start', props.node)
}

function onDragEnd() {
  dragReady.value = false
  cancelHold()
  emit('drag-end')
}

function onDragOver(event) {
  if (!props.movable || !isDir.value) return
  event.preventDefault()
  event.dataTransfer.dropEffect = 'move'
  dragOver.value = true
}

function onDragLeave() {
  dragOver.value = false
}

function onDrop(event) {
  if (!props.movable || !isDir.value) return
  event.preventDefault()
  event.stopPropagation()
  dragOver.value = false
  emit('drop-on', props.node)
}
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

function onContext(event) {
  emit('context', { node: props.node, event })
}
</script>

<style scoped>
.branch {
  min-width: 0;
}
.row.drag-over {
  outline: 1px dashed rgb(var(--v-theme-primary));
  outline-offset: -1px;
  background: rgba(var(--v-theme-primary), 0.12);
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
.spin {
  flex: 0 0 auto;
  margin: 0 1px;
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
