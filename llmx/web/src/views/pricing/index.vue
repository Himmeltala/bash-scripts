<template>
  <v-container fluid class="pa-4 page">
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
    <p v-if="loaded && !loadError" class="hint">
      保存后下一轮推送就按新价重算，不用重启服务。
    </p>
    <div v-if="loaded && !loadError" class="editor">
      <FileEditor
        ref="editorRef"
        root-name="llmx"
        :loader="loadFile"
        :saver="saveFile"
      />
    </div>
  </v-container>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { FileEditor } from '@bash-scripts/web-shared'
import { configApi } from './composables/useConfig'

const loaded = ref(false)
const loadError = ref('')
const writable = ref(true)
const editorRef = ref(null)
// 打开时只取一份：FileEditor 接着要内容时用同一份，免得一秒内发两次请求。
let info = null

function loadFile() {
  return Promise.resolve(info)
}

async function saveFile(target, text) {
  const data = await configApi.save(text)
  if (info) info = { ...info, text, size: data.size }
  return data
}

onMounted(async () => {
  try {
    info = await configApi.get()
    writable.value = info.writable
    loaded.value = true
    await editorRef.value?.open(info.path)
  } catch (err) {
    loadError.value = err.message
    loaded.value = true
  }
})
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--v-layout-top));
  overflow: hidden;
}

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
  flex: none;
  margin-bottom: 0.5rem;
  font-size: 0.78rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
</style>
