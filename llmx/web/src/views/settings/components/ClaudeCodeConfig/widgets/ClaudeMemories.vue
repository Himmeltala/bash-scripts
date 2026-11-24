<template>
  <div class="memories">
    <aside class="side">
      <v-select
        v-model="project"
        :items="projectItems"
        label="项目"
        density="compact"
        variant="outlined"
        hide-details
        class="pick"
      />
      <div class="files">
        <v-list v-if="files.length" density="compact" nav class="list">
          <v-list-item
            v-for="file in files"
            :key="file.name"
            :active="file.name === name"
            @click="open(file.name)"
          >
            <v-list-item-title class="mono">{{ file.name }}</v-list-item-title>
            <v-list-item-subtitle>{{ formatBytes(file.size) }} · {{ file.updated }}</v-list-item-subtitle>
          </v-list-item>
        </v-list>
        <p v-else class="hint">这个项目还没有记忆文件。</p>
      </div>
    </aside>

    <div class="editor">
      <FileEditor
        v-if="name"
        ref="editorRef"
        root-name="Claude Code"
        :loader="loadFile"
        :saver="saveFile"
      />
      <p v-else class="hint pad">左边选一个记忆文件。</p>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { toast } from '../../../../../composables/notice'
import { FileEditor } from '@bash-scripts/web-shared'
import { formatBytes } from '@bash-scripts/web-shared/format'
import { get, post } from '../../../../../composables/useApi'

const projects = ref([])
const project = ref('')
const name = ref('')
const info = ref({ path: '', exists: false, text: '', size: 0 })
const error = ref('')
watch(error, (text) => text && toast(text, 'error'))
const editorRef = ref(null)

const projectItems = computed(() => projects.value.map((item) => ({ title: item.id, value: item.id })))
const current = computed(() => projects.value.find((item) => item.id === project.value) || null)
const files = computed(() => (current.value ? current.value.files : []))

async function refresh() {
  const data = await get('/claude/memories')
  projects.value = data.projects || []
  if (!projects.value.some((item) => item.id === project.value)) {
    project.value = projects.value.length ? projects.value[0].id : ''
  }
}

async function open(file) {
  if (!project.value || !file) return
  name.value = file
  info.value = await get(
    `/claude/memories?project=${encodeURIComponent(project.value)}&name=${encodeURIComponent(file)}`
  )
  // 第一次选文件时编辑器还没挂上，等这一轮渲染完再打开。
  await nextTick()
  await editorRef.value?.open(info.value.path)
}

function loadFile() {
  return Promise.resolve(info.value)
}

async function saveFile(target, text) {
  const data = await post('/claude/memories', {
    project: project.value,
    name: name.value,
    text,
  })
  info.value = { ...info.value, text, size: data.size, exists: true }
  await refresh()
  return data
}

// 换项目就打开索引文件，没有索引再退到第一个。
watch(project, () => {
  const list = files.value
  if (!list.length) {
    name.value = ''
    return
  }
  open((list.find((file) => file.name === 'MEMORY.md') || list[0]).name)
})

onMounted(async () => {
  try {
    await refresh()
  } catch (err) {
    error.value = err.message
  }
})
</script>

<style scoped>
.memories {
  display: flex;
  gap: 1rem;
  height: 100%;
  min-height: 0;
}
.side {
  flex: 0 0 260px;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.pick {
  flex: none;
  padding-bottom: 0.5rem;
}
.files {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
}
.list {
  background: transparent;
}
.editor {
  flex: 1 1 auto;
  min-width: 0;
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
.pad {
  padding-top: 0.5rem;
}
.mono {
  font-family: 'JetBrains Mono', Roboto, 'Noto Sans SC', 'Source Han Sans SC',
    'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 0.78rem;
}
</style>
