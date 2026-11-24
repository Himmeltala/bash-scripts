<template>
  <FloatingDialog
    :model-value="modelValue"
    :initial-width="760"
    :initial-height="520"
    :min-width="540"
    :min-height="340"
    storage-key="sessions-garbage"
    storage="llmx.dialog-layouts"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #title>回收站</template>

    <div class="bar">
      <span class="hint">已选 {{ selected.length }} 个</span>
      <v-spacer />
      <v-btn
        variant="text"
        prepend-icon="mdi-undo-variant"
        :disabled="!selected.length"
        :loading="busy"
        @click="restoreSelected"
      >
        撤回
      </v-btn>
      <v-btn
        color="error"
        variant="tonal"
        prepend-icon="mdi-delete-forever-outline"
        :disabled="!selected.length"
        @click="confirmOpen = true"
      >
        彻底删除
      </v-btn>
    </div>

    <div class="table">
      <v-data-table
        v-model="selected"
        :headers="headers"
        :items="rows"
        item-value="id"
        show-select
        density="compact"
        fixed-header
        :loading="busy"
        :items-per-page="100"
        no-data-text="回收站是空的"
      >
        <template #[`item.name`]="{ item }">
          <span class="mono" :title="item.name">{{ item.name }}</span>
        </template>
        <template #[`item.files`]="{ item }">
          {{ item.files }}
        </template>
        <template #[`item.size`]="{ item }">
          {{ formatBytes(item.size) }}
        </template>
        <template #[`item.restorable`]="{ item }">
          <span :class="{ bad: !item.restorable }">{{ item.restorable ? '可撤回' : '原路径未知' }}</span>
        </template>
      </v-data-table>
    </div>

    <v-dialog v-model="confirmOpen" max-width="420">
      <v-card>
        <v-card-title>彻底删除</v-card-title>
        <v-card-text>
          将永久删除选中的 {{ selected.length }} 个会话文件，删掉后无法恢复。
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="confirmOpen = false">取消</v-btn>
          <v-btn color="error" variant="flat" :loading="busy" @click="purgeSelected">彻底删除</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <template #actions>
      <v-spacer />
      <v-btn variant="text" @click="emit('update:modelValue', false)">关闭</v-btn>
    </template>
  </FloatingDialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { toast } from '../../../../composables/notice'
import { FloatingDialog } from '@bash-scripts/web-shared/feedbacks'
import { formatBytes } from '@bash-scripts/web-shared/format'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  // 读回收目录清单、撤回与彻底删除，由会话页传进来。
  load: { type: Function, required: true },
  restore: { type: Function, required: true },
  purge: { type: Function, required: true },
})
const emit = defineEmits(['update:modelValue'])

const rows = ref([])
const selected = ref([])
const busy = ref(false)
const confirmOpen = ref(false)
const error = ref('')
watch(error, (text) => text && toast(text, 'error'))

const headers = [
  { title: '会话', key: 'name' },
  { title: '项目', key: 'project' },
  { title: '文件', key: 'files', width: 100 },
  { title: '大小', key: 'size', width: 150 },
  { title: '移入时间', key: 'moved', width: 150 },
  { title: '', key: 'restorable', width: 110 },
]

async function reload() {
  busy.value = true
  error.value = ''
  try {
    const data = await props.load()
    rows.value = data.files || []
    selected.value = selected.value.filter((id) => rows.value.some((row) => row.id === id))
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}

async function restoreSelected() {
  busy.value = true
  error.value = ''
  try {
    const data = await props.restore([...selected.value])
    toast(`已撤回 ${data.restored} 个会话文件`, 'success')
    await reload()
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}

async function purgeSelected() {
  busy.value = true
  error.value = ''
  try {
    const data = await props.purge([...selected.value])
    toast(`已彻底删除 ${data.removed} 个会话文件`, 'success')
    confirmOpen.value = false
    await reload()
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}

// 每次打开都重读，移走文件后不用手动刷新。
watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    selected.value = []
    reload()
  }
)
</script>

<style scoped>
.bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-bottom: 0.5rem;
}
.hint {
  font-size: 0.78rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.bad {
  color: rgb(var(--v-theme-error));
}
.table {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.table :deep(.v-data-table) {
  flex: 1 1 auto;
  min-height: 0;
}
.mono {
  font-family: 'JetBrains Mono', Roboto, 'Noto Sans SC', 'Source Han Sans SC',
    'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 0.78rem;
}
</style>
