<!--
 * @Author: Himmeltala
 * @Date: 2026-11-17 00:15:49
 * @LastEditors: Himmeltala
 * @LastEditTime: 2026-11-25 08:18:05
 * @FilePath: \lib\web-shared\src\components\commons\FileEditor\FileEditor.vue
 * @Description: 文件内容编辑器，按扩展名切换源码与渲染视图并负责保存。
-->
<template>
  <section class="file-editor">
    <FileHead
      v-if="path"
      :root-name="rootName"
      :path="path"
      :size="size"
    >
      <template #actions>
        <v-btn-toggle
          v-if="modes.length > 1"
          v-model="mode"
          density="default"
          variant="text"
          mandatory
          class="views"
        >
          <v-btn
            v-for="item in modes"
            :key="item.id"
            :value="item.id"
            :icon="!!item.icon"
            :title="item.icon ? item.title : undefined"
            size="x-small"
            variant="text"
            style="height: auto"
          >
            <v-icon v-if="item.icon">{{ item.icon }}</v-icon>
            <template v-else>{{ item.title }}</template>
          </v-btn>
        </v-btn-toggle>
        <div v-if="dirty && !state.loading" class="actions">
          <v-chip size="x-small" variant="flat" color="modified">未保存</v-chip>
          <v-btn
            size="small"
            variant="text"
            color="primary"
            :loading="state.saving"
            @click="save"
          >
            保存
          </v-btn>
          <v-btn size="small" variant="text" :disabled="state.saving" @click="discard">
            放弃
          </v-btn>
        </div>
      </template>
    </FileHead>

    <p v-if="state.loading" class="hint">正在读取文件…</p>
    <EmptyState
      v-else-if="state.error"
      icon="mdi-file-question-outline"
      :icon-size="28"
      :title="state.error"
      hint="换一个文件试试，或者从左侧目录里下载它。"
    />
    <div v-else-if="path" class="edit-wrap">
      <p v-if="modeError" class="hint bad edit-error">{{ modeError }}</p>
      <p v-if="state.saveError" class="hint bad edit-error">{{ state.saveError }}</p>
      <slot
        v-if="slotActive"
        name="editor"
        :value="state.draft"
        :update="updateDraft"
        :register="registerView"
        :path="path"
        :root-name="rootName"
        :size="size"
      />
      <template v-else>
        <component
          :is="modeComp"
          v-if="modeComp"
          ref="paneRef"
          v-model="state.draft"
          :path="path"
          @edit="$emit('edit', { path: path })"
        />
        <p v-else-if="modeLoading" class="hint">正在准备视图…</p>
      </template>
    </div>
    <EmptyState v-else icon="mdi-file-outline" hint="从左边选一个文件，右边显示它的内容。" />

    <SaveLeaveDialog :model-value="leaveAsk" :path="path" @answer="answerLeave" />
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, useSlots, watch } from 'vue'
import FileHead from './widgets/FileHead.vue'
import SaveLeaveDialog from './widgets/SaveLeaveDialog.vue'
import EmptyState from '../../../layouts/commons/EmptyState.vue'
import { useFileEditor } from './useFileEditor'
import {
  defaultModeOf,
  modesOf,
  resolveMode,
  usesEditorSlot,
  viewForOpen,
  viewLoadFailure,
} from './handlers/registry.js'

const props = defineProps({
  rootName: { type: String, default: '/' },
  size: { type: Number, default: undefined },
  // 取数与落盘由调用方给：打开哪个文件、存到哪里，组件不认。
  loader: { type: Function, required: true },
  saver: { type: Function, required: true },
})

const emit = defineEmits(['saved', 'dirty', 'edit'])
const slots = useSlots()

const {
  path,
  state,
  dirty,
  load,
  save: saveDraft,
  discard: discardDraft,
  reset,
} = useFileEditor({
  loader: props.loader,
  saver: props.saver,
})
const paneRef = ref(null)
// 插槽里的编辑器自己注册实例方法；内置处理器则用 paneRef。
const viewApi = ref(null)
const slotActive = computed(() => usesEditorSlot(path.value, !!slots.editor))

// 草稿改没改：页签栏靠这个标未保存，只在变化时报一次。
watch(dirty, (on) => emit('dirty', on))

// 文件类型处理器给出这类文件的渲染与编辑方式，具体组件按需加载。
const mode = ref('')
const modes = computed(() => modesOf(path.value))
const modeEntry = computed(() => modes.value.find((item) => item.id === mode.value) || null)
const modeComp = shallowRef(null)
const modeLoading = ref(false)
const modeError = ref('')
// 搜索命中要求的行号：处理器组件可能还在加载，挂上之后再定位。
let pendingLocate = 0

function currentView() {
  return slotActive.value ? viewApi.value : paneRef.value
}

function registerView(view) {
  viewApi.value = view
  if (view) locateWhenReady()
}

function updateDraft(value) {
  state.draft = value == null ? '' : String(value)
}

function locateWhenReady() {
  if (!pendingLocate) return
  const pane = currentView()
  if (!pane || typeof pane.locate !== 'function') return
  const line = pendingLocate
  pendingLocate = 0
  pane.locate(line)
}

// 换到没有这个视图的文件时回源码；同一会话里换文件不重置已选模式。
// 第一次打开按类型给默认视图（Markdown 双栏）；之后同一会话换文件沿用当前视图。
let modeInitialized = false
watch(
  modes,
  (list) => {
    const preferred = modeInitialized ? mode.value : defaultModeOf(path.value) || mode.value
    mode.value = resolveMode(preferred, list)
    if (path.value) modeInitialized = true
  },
  { immediate: true },
)

// 插槽接管代码文件时不再加载内置代码视图。
watch(
  slotActive,
  (on) => {
    if (!on) return
    modeComp.value = null
    modeError.value = ''
    modeLoading.value = false
    locateWhenReady()
  },
  { immediate: true },
)

watch(
  modeEntry,
  async (target) => {
    if (slotActive.value) {
      modeComp.value = null
      modeLoading.value = false
      return
    }
    modeComp.value = null
    modeLoading.value = !!target
    if (!target) return
    modeError.value = ''
    try {
      const mod = await target.load()
      // 加载期间可能已经切走，别把旧组件挂上来。
      if (modeEntry.value !== target) return
      modeComp.value = mod.default
      await nextTick()
      locateWhenReady()
    } catch (err) {
      // 分块加载失败（旧页面、断网、产物没同步）：退回源码并说明，别让按钮停在别的视图。
      if (modeEntry.value === target) {
        const failed = viewLoadFailure(err)
        modeError.value = failed.message
        mode.value = failed.mode
      }
    } finally {
      if (modeEntry.value === target) modeLoading.value = false
    }
  },
  { immediate: true },
)

// 保存成功后把结果交给调用方：目录树里的文件大小、差异都要跟着刷新。
async function save() {
  const target = path.value
  const data = await saveDraft()
  if (data) emit('saved', { path: target, data })
  return data
}

function discard() {
  discardDraft()
}

const leaveAsk = ref(false)
let leaveResolve = null

async function open(target, line = 0) {
  modeError.value = ''
  // 搜索命中带行号：渲染视图定位不了那一行，先回源码，跟改动前的跳行一致。
  mode.value = viewForOpen(mode.value, line)
  pendingLocate = line
  if (!(await load(target))) {
    pendingLocate = 0
    return false
  }
  await nextTick()
  if (!line) currentView()?.resetScroll()
  // 处理器组件可能还在加载，挂上后由 locateWhenReady 接着定位。
  locateWhenReady()
  return true
}

async function reload() {
  if (!path.value) return false
  if (!(await load(path.value))) return false
  await nextTick()
  currentView()?.resetScroll()
  return true
}

function close() {
  cancelLeave()
  reset()
}

// 换文件前统一问一句，没改过就直接走；已经弹着对话框时不再往下走。
function confirmLeave() {
  if (!dirty.value) return Promise.resolve(true)
  if (leaveAsk.value) return Promise.resolve(false)
  leaveAsk.value = true
  return new Promise((resolve) => {
    leaveResolve = resolve
  })
}

function answerLeave(drop) {
  leaveAsk.value = false
  if (!leaveResolve) return
  const resolve = leaveResolve
  leaveResolve = null
  resolve(drop)
}

function cancelLeave() {
  answerLeave(false)
}

// 草稿原文的取出与放回：调用方换走时拿走，回来读完同一个文件再放回去。
const text = computed(() => state.draft)
// 打开或上次保存时的磁盘内容：调用方拿它判断文件有没有在外面被改过。
const base = computed(() => state.base)
function restore(value) {
  state.draft = value == null ? '' : String(value)
}

onBeforeUnmount(() => answerLeave(false))

defineExpose({
  open,
  reload,
  close,
  save,
  discard,
  confirmLeave,
  cancelLeave,
  path,
  dirty,
  text,
  base,
  restore,
})
</script>

<style scoped src="./FileEditor.css"></style>
