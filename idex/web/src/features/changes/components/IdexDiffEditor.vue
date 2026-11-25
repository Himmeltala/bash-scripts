<!--
 * @Author: Himmeltala
 * @Date: 2026-11-25 08:30:00
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-25 08:31:41
 * @FilePath: \idex\web\src\features\changes\components\IdexDiffEditor.vue
 * @Description: idex 专用的差异编辑器：整份文件加改动标记，带 LSP 跳转与逐块还原。
-->
<template>
  <div class="diff-editor">
    <IdexCodeEditor
      ref="editorRef"
      :model-value="text"
      :path="path"
      :markers="markers"
      :diff="diffData"
      :minimap="preferences.minimap"
      :collapsed-ranges="collapsedRanges"
      :theme="preferences.editorTheme"
      :complete="complete"
      :format="formatText"
      :capabilities="capabilities"
      @update:model-value="onInput"
      @caret="onCaret"
      @edit="onEdit"
      @definition="onDefinition"
      @diffhunk="openHunk"
    />

    <div
      v-if="hunkMenu.on"
      class="hunk-menu"
      :style="{ left: `${hunkMenu.x}px`, top: `${hunkMenu.y}px` }"
    >
      <p class="hunk-title">这一块的原文</p>
      <pre class="hunk-text mono">{{ hunkMenu.original }}</pre>
      <div class="hunk-actions">
        <v-btn size="small" variant="text" @click="hunkMenu.on = false">关闭</v-btn>
        <v-btn
          size="small"
          color="primary"
          variant="flat"
          :loading="hunkMenu.busy"
          @click="restoreHunk"
        >
          还原此块
        </v-btn>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { api } from '../../../utils/api'
import { toast } from '../../../utils/notice'
import { handlerOf } from '../../editor/core/handlers/registry'
import { useDiagnostics } from '../../editor/composables/useDiagnostics'
import IdexCodeEditor from '../../editor/components/IdexCodeEditor.vue'
import { usePreferencesStore } from '../../../stores/preferences'
import { diffMarks, hunkOriginal, parseDiffHunks } from '../../browse/lib/diffLines'

const props = defineProps({
  ws: { type: Object, required: true },
  path: { type: String, required: true },
  // 工作区里的完整文件内容；差异只负责标出改动。
  content: { type: String, default: '' },
  // 统一差异文本，用来算改动行与每一块的原文。
  diffText: { type: String, default: '' },
  // hunks 只留改动附近的行，file 显示整份文件；折叠不改行号，LSP 照常可用。
  scope: { type: String, default: 'hunks' },
})
const emit = defineEmits(['dirty', 'saved', 'open'])

const preferences = usePreferencesStore()
const editorRef = ref(null)
const text = ref(props.content)
const dirty = ref(false)
const caret = reactive({ line: 1, column: 1 })
const servers = ref([])
const hunkMenu = reactive({ on: false, x: 0, y: 0, original: '', hunk: null, busy: false })

const hunks = computed(() => parseDiffHunks(props.diffText))
const COLLAPSE_CONTEXT = 3

const collapsedRanges = computed(() => {
  if (props.scope !== 'hunks' || !hunks.value.length) return []
  const total = text.value.split('\n').length
  const keep = []
  for (const hunk of hunks.value) {
    const start = Math.max(1, hunk.newStart - COLLAPSE_CONTEXT)
    const end = Math.min(total, hunk.newStart + hunk.newLines + COLLAPSE_CONTEXT)
    const last = keep[keep.length - 1]
    if (last && start <= last[1] + 1) last[1] = Math.max(last[1], end)
    else keep.push([start, end])
  }
  const ranges = []
  let cursor = 1
  for (const [start, end] of keep) {
    if (start - cursor >= 4) ranges.push([cursor, start - 1])
    cursor = Math.max(cursor, end + 1)
  }
  if (total - cursor + 1 >= 4) ranges.push([cursor, total])
  return ranges
})

function applyCollapse() {
  editorRef.value?.setCollapsedRanges?.(collapsedRanges.value)
}

watch([collapsedRanges, () => props.scope], () => nextTick(applyCollapse))
const diffData = computed(() =>
  hunks.value.length ? { hunks: hunks.value, marks: diffMarks(hunks.value) } : {},
)

const { markers, refreshDiagnostics, onEdit } = useDiagnostics({
  wsId: () => props.ws.id,
  activePath: () => props.path,
  editorOf: () => editorRef.value,
  onOpen: (loc) => emit('open', loc),
})

const capabilities = computed(() => {
  const id = handlerOf(props.path).server
  const info = id ? servers.value.find((item) => item.id === id) : null
  return (info && info.capabilities) || {}
})

function complete(payload) {
  return api.completion(props.ws.id, props.path, payload.text, payload.line, payload.character, payload.trigger)
}

function formatText(payload) {
  const options = handlerOf(props.path).formatOptions?.(props.path) || {}
  return api.format(
    props.ws.id,
    props.path,
    payload.text,
    options.tabSize ?? 4,
    options.insertSpaces ?? true,
  )
}

watch(
  () => props.content,
  (value) => {
    if (dirty.value) return
    text.value = value
    editorRef.value?.resetScroll?.()
    refreshDiagnostics(props.path)
  },
)

watch(
  () => props.path,
  () => {
    text.value = props.content
    dirty.value = false
    emit('dirty', false)
  },
)

function onCaret(value) {
  caret.line = value.line
  caret.column = value.column
}

function onInput(value) {
  text.value = value
  const changed = value !== props.content
  if (changed !== dirty.value) {
    dirty.value = changed
    emit('dirty', changed)
  }
}

async function onDefinition({ line, character, word }) {
  try {
    const data = await api.definition(props.ws.id, props.path, text.value, line, character)
    const list = (data && data.locations) || []
    if (!list.length) {
      toast(`没找到「${word}」的定义`, 'warning')
      return
    }
    const loc = list[0]
    if (loc.path === props.path) {
      editorRef.value?.locate(Number(loc.line || 0) + 1)
      return
    }
    // 跨文件：交给上层切到资源管理器打开对应位置。
    emit('open', loc)
  } catch (err) {
    toast(err.message, 'error')
  }
}

function openHunk(payload) {
  if (!payload || !payload.hunk) return
  hunkMenu.on = true
  hunkMenu.x = Math.max(8, Math.min(payload.x, window.innerWidth - 340))
  hunkMenu.y = Math.max(8, Math.min(payload.y, window.innerHeight - 260))
  hunkMenu.hunk = payload.hunk
  hunkMenu.original = hunkOriginal(hunks.value[payload.hunk])
}

async function restoreHunk() {
  if (!hunkMenu.hunk && hunkMenu.hunk !== 0) return
  hunkMenu.busy = true
  try {
    const hunk = hunks.value[hunkMenu.hunk]
    await api.restoreHunk(props.ws.id, props.path, hunk.text)
    hunkMenu.on = false
    toast('已还原这一块', 'primary')
    emit('saved', { path: props.path })
  } catch (err) {
    toast(`还原失败：${err.message}`, 'error')
  } finally {
    hunkMenu.busy = false
  }
}

async function save() {
  if (!dirty.value) return true
  try {
    // 读一遍磁盘：编辑期间别人改过就不写，避免盖掉外部改动。
    const snap = await api.file(props.ws.id, props.path)
    const disk = (snap.text || '').replace(/\r\n?/g, '\n')
    if (disk !== props.content) {
      toast('文件在编辑期间被改过，先刷新再改', 'error')
      return false
    }
    const data = await api.save(props.ws.id, props.path, text.value)
    dirty.value = false
    emit('dirty', false)
    emit('saved', { path: props.path, data })
    return true
  } catch (err) {
    toast(`保存失败：${err.message}`, 'error')
    return false
  }
}

function discard() {
  text.value = props.content
  dirty.value = false
  emit('dirty', false)
}

function reload() {
  text.value = props.content
  dirty.value = false
  emit('dirty', false)
  refreshDiagnostics(props.path)
  nextTick(applyCollapse)
}

onMounted(async () => {
  text.value = props.content
  try {
    const data = await api.lspStatus()
    servers.value = data.servers || []
  } catch (err) {
    // 没有语言服务器就只做差异展示。
  }
  refreshDiagnostics(props.path)
})

defineExpose({ save, discard, reload, isDirty: () => dirty.value })
</script>

<style scoped>
.diff-editor {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.hunk-menu {
  position: fixed;
  z-index: 10;
  width: 320px;
  padding: 9px;
  border-radius: 8px;
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.32);
}
.hunk-title {
  margin: 0 0 6px;
  font-size: 0.78rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.hunk-text {
  margin: 0;
  max-height: 150px;
  overflow: auto;
  padding: 6px 8px;
  font-size: 0.72rem;
  white-space: pre-wrap;
  background: rgb(var(--v-theme-surface-variant));
  border-radius: 6px;
}
.hunk-actions {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  margin-top: 6px;
}
</style>
