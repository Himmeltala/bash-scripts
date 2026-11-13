<template>
  <div class="file-tree">
    <template v-if="root">
      <FileTreeNode
        :node="root"
        :depth="0"
        :expanded="expanded"
        :cache="cache"
        :key-of="keyOf"
        :dir-of="dirOf"
        :name-of="nameOf"
        :label-class="labelClass"
        :row-class="rowClass"
        :pick-on-row-click="pickOnRowClick"
        :texts="texts"
        @toggle="toggle"
        @pick="emit('pick', $event)"
      >
        <template #row-before-label="scope">
          <slot name="row-before-label" v-bind="scope" />
        </template>
        <template #row-after-label="scope">
          <slot name="row-after-label" v-bind="scope" />
        </template>
      </FileTreeNode>
    </template>

    <template v-else>
      <p v-if="rootState.loading" class="hint">{{ text.rootLoading }}</p>
      <p v-else-if="rootState.error" class="hint bad">{{ rootState.error }}</p>
      <p v-else-if="!rootState.entries.length" class="hint">{{ text.rootEmpty }}</p>
      <template v-else>
        <FileTreeNode
          v-for="node in rootState.entries"
          :key="keyOf(node)"
          :node="node"
          :depth="0"
          :expanded="expanded"
          :cache="cache"
          :key-of="keyOf"
          :dir-of="dirOf"
          :name-of="nameOf"
          :label-class="labelClass"
          :row-class="rowClass"
          :pick-on-row-click="pickOnRowClick"
          :texts="texts"
          @toggle="toggle"
          @pick="emit('pick', $event)"
        >
          <template #row-before-label="scope">
            <slot name="row-before-label" v-bind="scope" />
          </template>
          <template #row-after-label="scope">
            <slot name="row-after-label" v-bind="scope" />
          </template>
        </FileTreeNode>
        <p v-if="rootState.truncated" class="hint">{{ text.truncated }}</p>
      </template>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import FileTreeNode from './FileTreeNode.vue'

const props = defineProps({
  loader: { type: Function, required: true },
  // 传根节点就在树顶显示这一行（调用方自己给名字与空键），不传就直接列第一层。
  root: { type: Object, default: null },
  keyOf: { type: Function, default: (node) => node.path },
  dirOf: { type: Function, default: (node) => node.type === 'dir' },
  nameOf: { type: Function, default: (node) => node.name },
  labelClass: { type: String, default: '' },
  rowClass: { type: Function, default: null },
  pickOnRowClick: { type: Boolean, default: false },
  // 面板没显示时不读目录，切过来才拉第一层。
  active: { type: Boolean, default: true },
  texts: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['pick'])

const DEFAULTS = {
  loading: '正在读取…',
  empty: '空目录',
  truncated: '这一层文件太多，只列了前面一部分。',
  rootLoading: '正在读取目录…',
  rootEmpty: '空目录',
}
const text = computed(() => ({ ...DEFAULTS, ...props.texts }))
const EMPTY = { loading: false, error: '', entries: [], truncated: false }

// 展开状态与读过的孩子各存一份，节点自己不带副本。
const expanded = reactive({})
const cache = reactive({})
const started = ref(false)

const rootKey = computed(() => (props.root ? props.keyOf(props.root) : ''))
const rootState = computed(() => cache[rootKey.value] || EMPTY)

async function load(key, force = false) {
  if (!force && cache[key]) return
  if (!cache[key]) cache[key] = { loading: false, error: '', entries: [], truncated: false }
  const state = cache[key]
  state.loading = true
  state.error = ''
  try {
    const data = await props.loader(key)
    state.entries = data.entries || []
    state.truncated = data.truncated || false
  } catch (err) {
    state.error = err.message
    state.entries = []
  } finally {
    state.loading = false
  }
}

function toggle(key) {
  expanded[key] = !expanded[key]
  if (expanded[key]) load(key)
}

// 从根往下逐层展开到指定路径，搜索命中与面包屑都走这里。
async function reveal(key) {
  expanded[rootKey.value] = true
  await load(rootKey.value)
  let prefix = rootKey.value
  for (const seg of String(key || '').split('/').filter(Boolean)) {
    prefix = prefix ? `${prefix}/${seg}` : seg
    await load(prefix)
    expanded[prefix] = true
  }
}

// 全量重读：展开状态一并清掉，回到只看第一层。
function reload() {
  for (const key of Object.keys(cache)) delete cache[key]
  for (const key of Object.keys(expanded)) delete expanded[key]
  expanded[rootKey.value] = true
  load(rootKey.value)
}

async function reloadDir(key) {
  await load(key, true)
}

async function refreshAll() {
  await Promise.all(Object.keys(cache).map((key) => load(key, true)))
}

function activate() {
  if (!props.active || started.value) return
  started.value = true
  expanded[rootKey.value] = true
  load(rootKey.value)
}

if (props.active) activate()
onMounted(activate)
watch(
  () => props.active,
  (on) => {
    if (on) activate()
  },
)

defineExpose({ reveal, reload, reloadDir, refreshAll, toggle })
</script>

<style scoped>
.file-tree {
  min-width: 0;
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
