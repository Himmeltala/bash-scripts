<template>
  <FloatingDialog
    :model-value="modelValue"
    :initial-width="520"
    :initial-height="440"
    :min-width="420"
    :min-height="320"
    storage-key="profile-new"
    storage="llmx.dialog-layouts"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #title>新建配置档</template>

    <v-text-field
      v-model="name"
      label="名称"
      density="compact"
      variant="outlined"
      maxlength="64"
      autofocus
      @keyup.enter="submit"
    />
    <v-select
      v-model="source"
      :items="sources"
      item-title="title"
      item-value="key"
      label="初始内容"
      density="compact"
      variant="outlined"
    />
    <v-select
      v-if="source === 'profile'"
      v-model="origin"
      :items="existing"
      label="复制哪一份"
      density="compact"
      variant="outlined"
    />
    <p class="hint">名称就是文件名，允许中文，不能带路径分隔符，也不能与已有配置档重名。</p>
    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-2">
      {{ error }}
    </v-alert>

    <template #actions>
      <v-spacer />
      <v-btn variant="text" @click="close">取消</v-btn>
      <v-btn color="primary" variant="flat" :loading="busy" :disabled="!name" @click="submit">
        创建
      </v-btn>
    </template>
  </FloatingDialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { FloatingDialog } from '@bash-scripts/web-shared'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  existing: { type: Array, default: () => [] },
  hasTarget: { type: Boolean, default: false },
  // 从某一份复制时带进来：名称、来源与源配置档。
  preset: { type: Object, default: null },
  submit: { type: Function, required: true },
})
const emit = defineEmits(['update:modelValue'])

const name = ref('')
const source = ref('blank')
const origin = ref('')
const error = ref('')
const busy = ref(false)

const sources = computed(() => {
  const list = []
  if (props.hasTarget) list.push({ key: 'settings', title: '复制当前 settings.json' })
  if (props.existing.length) list.push({ key: 'profile', title: '复制已有配置档' })
  list.push({ key: 'blank', title: '空白 {}' })
  return list
})

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    error.value = ''
    busy.value = false
    name.value = ''
    source.value = props.hasTarget ? 'settings' : 'blank'
    origin.value = props.existing[0] || ''
    if (props.preset) {
      name.value = props.preset.name || ''
      source.value = props.preset.from || source.value
      origin.value = props.preset.source || origin.value
    }
    if (!sources.value.some((item) => item.key === source.value)) source.value = 'blank'
  },
)

function close() {
  emit('update:modelValue', false)
}

async function submit() {
  if (!name.value) return
  if (source.value === 'profile' && !origin.value) {
    error.value = '先选一份要复制的配置档'
    return
  }
  busy.value = true
  error.value = ''
  try {
    await props.submit({
      name: name.value,
      from: source.value,
      source: source.value === 'profile' ? origin.value : null,
    })
    close()
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}
</script>
