<template>
  <FloatingDialog
    :model-value="modelValue"
    storage-key="netx-clean"
    :initial-width="620"
    :initial-height="560"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <template #title>清理记录</template>

    <div v-if="info" class="summary">
      <div class="row"><span>数据库占用</span><b>{{ size }}</b></div>
      <div class="row"><span>连接 / 详情</span><b>{{ info.flow_count }} / {{ info.detail_count }}</b></div>
      <div class="row"><span>进行中的连接</span><b>{{ info.active_count }} 条，不会被删</b></div>
    </div>

    <v-select
      v-model="scope"
      :items="SCOPES"
      item-title="label"
      item-value="value"
      label="清理范围"
      density="compact"
      variant="outlined"
      hide-details
      class="field"
    />

    <p class="hint">删除的是连接与详情，采集状态保留；删除后数据库会压缩。</p>

    <v-alert v-if="preview" type="info" variant="tonal" density="compact" class="result">
      {{ previewText }}
    </v-alert>

    <template #actions>
      <v-spacer />
      <v-btn variant="text" @click="close">取消</v-btn>
      <v-btn variant="tonal" :disabled="busy" @click="runPreview">预览</v-btn>
      <v-btn
        color="error"
        variant="flat"
        :disabled="!preview || busy"
        :loading="busy"
        @click="remove"
      >
        确认删除
      </v-btn>
    </template>
  </FloatingDialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { FloatingDialog, useToast } from '@bash-scripts/web-shared/feedbacks'
import { formatBytes } from '@bash-scripts/web-shared/format'
import { clean as cleanRecords, summary } from '../composables/useApi'

const SCOPES = [
  { label: '删除 7 天前的已结束连接', value: 7 },
  { label: '删除 30 天前的已结束连接', value: 30 },
  { label: '删除全部已结束的连接', value: 'all' },
]

const props = defineProps({
  modelValue: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'done', 'notice'])

const info = ref(null)
const scope = ref(7)
const preview = ref(null)
const error = ref('')
const { toast } = useToast()
watch(error, (text) => {
  if (text) toast(text, 'error')
})
const busy = ref(false)

const size = computed(() =>
  info.value
    ? formatBytes(info.value.db_bytes, { units: ['B', 'KB', 'MB', 'GB'], precision: [0, 1, 2, 2] })
    : '—',
)
const previewText = computed(() => {
  const data = preview.value
  if (!data) return ''
  return (
    '将删除 ' +
    data.flows +
    ' 条连接、' +
    data.details +
    ' 条详情；保留 ' +
    data.active_kept +
    ' 条进行中的连接。'
  )
})

function body(dryRun) {
  const payload = scope.value === 'all' ? { all: true } : { before_days: scope.value }
  if (dryRun) payload.dry_run = true
  return payload
}

async function load() {
  error.value = ''
  try {
    info.value = await summary()
  } catch (err) {
    error.value = err.message
  }
}

async function runPreview() {
  busy.value = true
  error.value = ''
  try {
    preview.value = await cleanRecords(body(true))
  } catch (err) {
    preview.value = null
    error.value = err.message
  } finally {
    busy.value = false
  }
}

async function remove() {
  busy.value = true
  error.value = ''
  try {
    const result = await cleanRecords(body(false))
    const warning = result.vacuum_error ? '；压缩失败：' + result.vacuum_error : ''
    emit('notice', {
      text: '已删除 ' + result.flows + ' 条连接、' + result.details + ' 条详情' + warning,
      color: result.vacuum_error ? 'warning' : 'success',
    })
    emit('done')
    close()
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}

function close() {
  emit('update:modelValue', false)
}

watch(scope, () => {
  preview.value = null
})

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    preview.value = null
    error.value = ''
    load()
  },
)
</script>

<style scoped>
.summary {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}
.row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  font-size: 0.9rem;
}
.row > span {
  color: rgb(var(--v-theme-on-surface-variant));
}
.row b {
  font-weight: 500;
}
.field {
  margin-bottom: 8px;
}
.hint {
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.82rem;
  margin: 0 0 14px;
}
.result {
  margin-top: 10px;
}
</style>
