<template>
  <div class="panel">
    <div class="bar">
      <div class="meta">
        <span class="url mono" :title="info.url || ws.root">{{ info.url || ws.root }}</span>
        <span v-if="isGit && info.branch" class="rev">{{ info.branch }}</span>
        <span v-if="info.revision" class="rev">{{ revText }}</span>
        <span class="count">{{ files.length }} 项变更</span>
        <span v-if="truncated" class="count warn" title="未纳入版本控制的文件太多">
          只列了前 200 个未纳入版本控制的文件
        </span>
      </div>
      <v-btn
        size="small"
        variant="text"
        color="primary"
        prepend-icon="mdi-refresh"
        :loading="loading"
        @click="load"
      >
        刷新
      </v-btn>
    </div>

    <p v-if="error" class="hint bad">{{ error }}</p>

    <div class="split">
      <aside class="files">
        <p v-if="!loading && !files.length" class="none">工作副本是干净的，没有未提交的变更。</p>
        <ul>
          <li
            v-for="file in files"
            :key="file.path"
            class="item"
            :class="{ active: selected && selected.path === file.path }"
            @click="pick(file)"
          >
            <span class="letter" :style="{ color: tone(file) }">{{ statusOf(file.item).letter }}</span>
            <div class="names">
              <div class="name mono" :title="file.path">{{ baseName(file.path) }}</div>
              <div v-if="dirName(file.path)" class="dir mono" :title="file.path">
                {{ dirName(file.path) }}
              </div>
            </div>
            <span class="state">{{ statusOf(file.item).text }}</span>
          </li>
        </ul>
      </aside>

      <section class="view">
        <DiffView
          :title="diffTitle"
          :text="content.text"
          :kind="content.kind"
          :truncated="content.truncated"
          :loading="diffLoading"
          :error="diffError"
        />
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import DiffView from './DiffView.vue'
import { api } from '../composables/useApi'
import { baseName, dirName, statusOf } from '../composables/format'

const props = defineProps({
  ws: { type: Object, required: true },
})
const emit = defineEmits(['loaded'])

const info = ref({})
const files = ref([])
const truncated = ref(false)
const selected = ref(null)
const content = ref({ text: '', kind: 'diff', truncated: false })
const loading = ref(false)
const diffLoading = ref(false)
const error = ref('')
const diffError = ref('')

const isGit = computed(() => props.ws.vcs === 'git')
const diffTitle = computed(() => (selected.value ? selected.value.path : ''))
// SVN 的版本号前面带 r，Git 给的是短 sha，原样显示。
const revText = computed(() => {
  const rev = info.value.revision
  if (!rev) return ''
  return isGit.value ? rev : `r${rev}`
})

function tone(file) {
  return `rgb(var(--v-theme-${statusOf(file.item).color}))`
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await api.changes(props.ws.id)
    info.value = data.info || {}
    files.value = data.files || []
    truncated.value = !!data.truncated
    emit('loaded', files.value.length)
    // 选中的文件还在列表里就留着，不在就退回第一项，右侧不至于空着。
    const hit = files.value.find((f) => selected.value && f.path === selected.value.path)
    if (hit) {
      selected.value = hit
    } else {
      selected.value = null
      content.value = { text: '', kind: 'diff', truncated: false }
      if (files.value.length) await pick(files.value[0])
    }
  } catch (err) {
    error.value = err.message
    emit('loaded', 0)
  } finally {
    loading.value = false
  }
}

async function pick(file) {
  selected.value = file
  diffLoading.value = true
  diffError.value = ''
  try {
    content.value = await api.diff(props.ws.id, file.path, file.item)
  } catch (err) {
    content.value = { text: '', kind: 'diff', truncated: false }
    diffError.value = err.message
  } finally {
    diffLoading.value = false
  }
}

watch(() => props.ws.id, load)
onMounted(load)

defineExpose({ load })
</script>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}
.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 12px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}
.meta {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.url {
  font-size: 0.78rem;
  color: rgb(var(--v-theme-on-surface-variant));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rev,
.warn {
  color: rgb(var(--v-theme-modified));
}
.count {
  font-size: 0.75rem;
  color: rgb(var(--v-theme-on-surface-variant));
  white-space: nowrap;
}
.split {
  flex: 1 1 auto;
  display: flex;
  min-height: 0;
}
.files {
  width: 320px;
  flex: 0 0 320px;
  overflow: auto;
  border-right: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}
.files ul {
  list-style: none;
  margin: 0;
  padding: 4px;
}
.item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border-radius: 6px;
  cursor: pointer;
  min-height: 30px;
}
.item:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
}
.item.active {
  background: rgba(var(--v-theme-primary), 0.14);
}
.letter {
  flex: 0 0 16px;
  text-align: center;
  font-weight: 600;
  font-size: 0.8rem;
}
.names {
  flex: 1 1 auto;
  min-width: 0;
}
.name {
  font-size: 0.8rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dir {
  font-size: 0.72rem;
  color: rgb(var(--v-theme-on-surface-variant));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.state {
  flex: 0 0 auto;
  font-size: 0.7rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.view {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.none {
  padding: 12px 16px;
  font-size: 0.86rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.hint {
  margin: 8px 12px;
  font-size: 0.82rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.hint.bad {
  color: rgb(var(--v-theme-error));
}
@media (max-width: 900px) {
  .split {
    flex-direction: column;
  }
  .files {
    width: 100%;
    flex: 0 0 auto;
    max-height: 220px;
    border-right: none;
    border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  }
}
</style>
