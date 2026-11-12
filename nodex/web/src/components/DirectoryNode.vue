<template>
  <div class="node">
    <div ref="rowEl" class="row" :class="{ selected: node.path === selected }" @click="choose">
      <v-btn
        :icon="true"
        size="x-small"
        variant="text"
        class="arrow"
        :title="open ? '收起' : '展开'"
        @click.stop="toggle"
      >
        <v-icon size="18">{{ open ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
      </v-btn>
      <v-icon size="18" class="folder">mdi-folder-outline</v-icon>
      <span class="label" :title="node.path">{{ node.name }}</span>
    </div>
    <div v-if="open" class="kids">
      <p v-if="loading" class="hint">正在读取…</p>
      <p v-else-if="error" class="hint bad">{{ error }}</p>
      <template v-else-if="node.children">
        <DirectoryNode
          v-for="child in node.children"
          :key="child.path"
          :node="child"
          :selected="selected"
          @pick="$emit('pick', $event)"
        />
        <p v-if="!node.children.length" class="hint">没有子目录</p>
      </template>
    </div>
  </div>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue'
import { api } from '../composables/useApi'

const props = defineProps({
  node: { type: Object, required: true },
  selected: { type: String, default: '' },
})
const emit = defineEmits(['pick'])

// 展开状态留在节点自己身上：切到别的目录再回来，不用重新拉一遍。
const open = ref(false)
const loading = ref(false)
const error = ref('')
const rowEl = ref(null)

// 选中的这一条滚进可视区：树比对话框高时，点完深处那一项不至于看不见。
watch(
  () => props.selected === props.node.path,
  (hit) => {
    if (!hit) return
    nextTick(() => rowEl.value && rowEl.value.scrollIntoView({ block: 'nearest' }))
  },
  { immediate: true }
)

// 点整行：选中它，没展开过就顺手展开；点箭头只管展开收起，不改变选中。
async function choose() {
  emit('pick', props.node)
  if (!open.value) {
    open.value = true
    await load()
  }
}

async function toggle() {
  open.value = !open.value
  if (open.value) await load()
}

async function load() {
  if (props.node.children || loading.value) return
  loading.value = true
  error.value = ''
  try {
    const data = await api.dirs(props.node.path)
    // 子目录挂在节点上，展开过的不会重复请求。
    props.node.children = data.entries
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.row {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 8px 2px 0;
  border-radius: 6px;
  cursor: pointer;
  min-height: 32px;
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
.folder {
  color: rgb(var(--v-theme-primary));
  flex: 0 0 auto;
}
.label {
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.kids {
  padding-left: 20px;
  border-left: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  margin-left: 14px;
}
.hint {
  margin: 2px 0 2px 8px;
  font-size: 0.78rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.hint.bad {
  color: rgb(var(--v-theme-error));
}
</style>
