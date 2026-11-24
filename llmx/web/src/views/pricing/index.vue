<template>
  <v-container fluid class="pa-2 page">
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
import { nextTick, onMounted, ref, watch } from 'vue'
import { FileEditor } from '@bash-scripts/web-shared'
import { configApi } from './composables/useConfig'
import { toast } from '../../composables/notice'

const loaded = ref(false)
const loadError = ref('')
const writable = ref(true)

// 反馈统一走 snackbar：加载失败与“只能查看”都不再占页面位置。
watch(loadError, (text) => text && toast(text, 'error'))
watch([loaded, writable], ([ready, ok]) => {
  if (ready && !ok) {
    toast('当前页面不是从本机打开的，只能查看；要修改请用 --allow-write 启动服务。', 'warning')
  }
})
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
    // 编辑器挂在 loaded 后面，同一个 tick 里 ref 还是空的，等这轮渲染完再打开。
    await nextTick()
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
</style>
