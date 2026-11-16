<template>
  <div class="picker">
    <p v-if="tip" class="tip">{{ tip }}</p>
    <v-text-field
      v-model="path"
      :label="label"
      :placeholder="placeholder"
      prepend-inner-icon="mdi-folder"
      :error="!!modelValue && !valid"
      :error-messages="modelValue && !valid ? invalidText : ''"
      hide-details="auto"
      autofocus
    />

    <div class="tree">
      <div class="root">
        <v-icon size="18">mdi-home-outline</v-icon>
        <span class="root-label" :title="home || '~'">~</span>
        <v-progress-circular v-if="loading" size="12" width="2" indeterminate />
      </div>
      <p v-if="loadError" class="hint bad">{{ loadError }}</p>
      <template v-else-if="roots">
        <DirectoryNode
          v-for="node in roots"
          :key="node.path"
          :node="node"
          :selected="target"
          :loader="loader"
          @pick="pick"
        />
        <p v-if="!roots.length" class="hint">家目录下没有子目录</p>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watchEffect } from 'vue'
import DirectoryNode from './DirectoryNode.vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  tip: { type: String, default: '' },
  label: { type: String, default: '目录' },
  placeholder: { type: String, default: '' },
  // 取目录的函数：不传参数取家目录这一层，传路径取它的下一层。
  loader: { type: Function, required: true },
  // 自定义校验：收到 (target, home)，返回能不能选；不传就按家目录以内判断。
  validate: { type: Function, default: null },
  invalidText: { type: String, default: '只能添加家目录内的目录' },
})
const emit = defineEmits(['update:modelValue', 'update:valid'])

const home = ref('')
const roots = ref(null)
const loading = ref(true)
const loadError = ref('')

const path = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

// 手输的 ~ 与末尾斜杠先归一再比，选中高亮与校验用的是同一个值。
const target = computed(() => {
  let text = String(props.modelValue || '').trim()
  if (text === '~') text = home.value
  else if (text.startsWith('~/')) text = home.value + text.slice(1)
  return text.replace(/\/+$/, '')
})

const valid = computed(() => {
  if (!home.value || !target.value) return false
  if (props.validate) return Boolean(props.validate(target.value, home.value))
  return target.value === home.value || target.value.startsWith(home.value + '/')
})

watchEffect(() => emit('update:valid', valid.value))

function pick(node) {
  path.value = node.path
}

onMounted(async () => {
  try {
    const data = await props.loader()
    home.value = data.home
    roots.value = data.entries.map((item) => ({ ...item, children: null }))
  } catch (err) {
    loadError.value = err.message
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.tip {
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.86rem;
  margin: 0 0 12px;
}
.tree {
  margin-top: 12px;
  max-height: 320px;
  overflow: auto;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 8px;
  padding: 6px 4px;
}
.root {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  font-weight: 500;
}
.root-label {
  font-size: 0.9rem;
}
.hint {
  margin: 4px 12px;
  font-size: 0.8rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.hint.bad {
  color: rgb(var(--v-theme-error));
}
</style>
