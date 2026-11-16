<template>
  <div class="memory">
    <div class="bar">
      <span class="path mono">{{ info.path || '~/.claude/CLAUDE.md' }}</span>
      <v-chip v-if="loaded && !info.writable" size="x-small" variant="tonal">只读</v-chip>
      <v-spacer />
      <span class="hint">
        {{ info.exists ? '' : '文件还不存在，保存时新建。' }}改完对新开的会话生效。
      </span>
    </div>
    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-2">
      {{ error }}
    </v-alert>
    <div class="editor">
      <FileEditor
        ref="editorRef"
        root-name="Claude Code"
        :loader="loadFile"
        :saver="saveFile"
      />
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { FileEditor } from '@bash-scripts/web-shared'
import { get, post } from '../../../../../composables/useApi'

const info = ref({ path: '', exists: false, text: '', size: 0, writable: true })
const loaded = ref(false)
const error = ref('')
const editorRef = ref(null)

function loadFile() {
  return Promise.resolve(info.value)
}

async function saveFile(target, text) {
  const data = await post('/claude/memory', { text })
  info.value = { ...info.value, text, size: data.size, exists: true }
  return data
}

onMounted(async () => {
  try {
    info.value = await get('/claude/memory')
    await editorRef.value?.open(info.value.path)
  } catch (err) {
    error.value = err.message
  } finally {
    loaded.value = true
  }
})
</script>

<style scoped>
.memory {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.bar {
  flex: none;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-bottom: 0.5rem;
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

.path {
  font-size: 0.8rem;
  word-break: break-all;
}

.mono {
  font-family: 'JetBrains Mono', monospace;
}

.hint {
  font-size: 0.78rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
</style>
