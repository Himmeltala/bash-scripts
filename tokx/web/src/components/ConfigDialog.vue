<template>
  <FloatingDialog
    :model-value="modelValue"
    :initial-width="1040"
    :initial-height="760"
    storage-key="config"
    storage="tokx.dialog-layouts"
    @update:model-value="onToggle"
  >
    <template #title>
      <span>价格与配置</span>
      <v-spacer />
      <v-btn :icon="true" variant="text" title="关闭" @click="close">
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </template>

    <v-alert
      v-if="loaded && !writable"
      type="info"
      variant="tonal"
      density="compact"
      class="mb-2"
    >
      当前页面不是从本机打开的，只能查看；要在这台机器外修改，用 --allow-write 启动服务。
    </v-alert>
    <v-alert v-if="loadError" type="error" variant="tonal" density="compact" class="mb-2">
      {{ loadError }}
    </v-alert>
    <div v-if="loaded && !loadError" class="editor">
      <FileEditor
        ref="editorRef"
        root-name="tokx"
        :loader="loadFile"
        :saver="saveFile"
      />
    </div>

    <template #actions>
      <span class="hint">保存后下一轮推送就按新价重算，不用重启服务。</span>
      <v-spacer />
      <v-btn variant="text" @click="close">关闭</v-btn>
    </template>
  </FloatingDialog>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue'
import { FileEditor, FloatingDialog } from '@bash-scripts/web-shared'
import { configApi } from '../composables/useConfig'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])

const loaded = ref(false)
const loadError = ref('')
const writable = ref(true)
const editorRef = ref(null)
// 每次打开只取一份：FileEditor 接着要内容时用同一份，免得一秒内发两次请求。
let info = null

function loadFile() {
  return Promise.resolve(info)
}

async function saveFile(target, text) {
  const data = await configApi.save(text)
  if (info) info = { ...info, text, size: data.size }
  return data
}

// 打开时读整份配置；文件不存在时服务端给一份按当前价生成的。
watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return
    loaded.value = false
    loadError.value = ''
    try {
      info = await configApi.get()
      writable.value = info.writable
      loaded.value = true
      await nextTick()
      await editorRef.value?.open(info.path)
    } catch (err) {
      loadError.value = err.message
      loaded.value = true
    }
  },
  { immediate: true },
)

// 点 X、按 Esc 或点遮罩都走这里；有没保存的改动先问一句。
async function close() {
  const editor = editorRef.value
  if (editor?.dirty) {
    const leave = await editor.confirmLeave()
    if (!leave) return
  }
  editor?.close()
  emit('update:modelValue', false)
}

function onToggle(value) {
  if (value) emit('update:modelValue', true)
  else close()
}
</script>

<style scoped>
.editor {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
}

.editor > * {
  flex: 1 1 auto;
  min-width: 0;
}

.hint {
  font-size: 0.78rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
</style>
