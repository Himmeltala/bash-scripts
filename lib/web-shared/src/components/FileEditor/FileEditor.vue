<template>
  <section class="file-editor">
    <FileHead
      v-if="path"
      :root-name="rootName"
      :path="path"
      :size="size"
      @navigate="emit('navigate', $event)"
    >
      <template #actions>
        <div v-if="dirty && !state.loading" class="actions">
          <v-chip size="x-small" variant="flat" color="warning">未保存</v-chip>
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
    <p v-else-if="state.error" class="hint bad">{{ state.error }}</p>
    <div v-else-if="path" class="edit-wrap">
      <p v-if="state.saveError" class="hint bad edit-error">{{ state.saveError }}</p>
      <EditorPane
        ref="paneRef"
        v-model="state.draft"
        :highlighted="highlighted"
        :line-count="lineCount"
      />
    </div>
    <div v-else class="none">从左边选一个文件，右边显示它的内容。</div>

    <SaveLeaveDialog :model-value="leaveAsk" :path="path" @answer="answerLeave" />
  </section>
</template>

<script setup>
import { nextTick, onBeforeUnmount, ref } from 'vue'
import EditorPane from './widgets/EditorPane.vue'
import FileHead from './widgets/FileHead.vue'
import SaveLeaveDialog from './widgets/SaveLeaveDialog.vue'
import { useFileEditor } from './useFileEditor'

const props = defineProps({
  rootName: { type: String, default: '/' },
  size: { type: Number, default: undefined },
  // 取数与落盘由调用方给：打开哪个文件、存到哪里，组件不认。
  loader: { type: Function, required: true },
  saver: { type: Function, required: true },
})

const emit = defineEmits(['navigate', 'saved'])

const {
  path,
  state,
  dirty,
  lineCount,
  highlighted,
  load,
  save: saveDraft,
  discard: discardDraft,
  reset,
} = useFileEditor({
  loader: props.loader,
  saver: props.saver,
})
const paneRef = ref(null)

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
  if (!(await load(target))) return false
  await nextTick()
  paneRef.value?.resetScroll()
  if (line) paneRef.value?.locate(line)
  return true
}

async function reload() {
  if (!path.value) return false
  if (!(await load(path.value))) return false
  await nextTick()
  paneRef.value?.resetScroll()
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

onBeforeUnmount(() => answerLeave(false))

defineExpose({ open, reload, close, save, discard, confirmLeave, cancelLeave, dirty })
</script>

<style scoped src="./FileEditor.css"></style>
