<script setup>
import { computed, ref, watch } from 'vue'
import { data } from '../composables/useUsage'
import { fmtMoney, fmtNum, fmtTokens } from '../lib/format'
import { setTag, tagOf } from '../composables/useSessionTags'
import { get } from '../../../composables/useApi'
import { toast } from '../../../composables/notice'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  row: { type: Object, default: null },
})
const emit = defineEmits(['update:modelValue'])

const loading = ref(false)
const detail = ref(null)

const title = computed(() => (props.row ? props.row.session : ''))
const tag = computed(() => tagOf(props.row))
const note = ref('')

function toggle(key) {
  setTag(props.row, { [key]: !tag.value[key] })
}

function saveNote() {
  setTag(props.row, { note: note.value.trim() })
}

const headers = [
  { title: '时间', key: 'at', width: 140 },
  { title: '模型', key: 'model', width: 180 },
  { title: '项目', key: 'project', width: 140 },
  { title: '输入', key: 'input', width: 100 },
  { title: '缓存读', key: 'cache_read', width: 100 },
  { title: '输出', key: 'output', width: 100 },
  { title: '命中', key: 'cache_hit', width: 84 },
  { title: '费用', key: 'cost', width: 100 },
]

function cell(item, key) {
  const value = item[key]
  if (value == null || value === '') return '-'
  if (key === 'cache_hit') return `${(Number(value) * 100).toFixed(1)}%`
  if (key === 'cost') return `¥${fmtMoney(value)}`
  if (key === 'input' || key === 'cache_read' || key === 'output') return fmtNum(value)
  return value
}

async function load() {
  if (!props.row) return
  loading.value = true
  detail.value = null
  try {
    const params = new URLSearchParams({
      command: 'session',
      source: props.row.source,
      session: props.row.session,
    })
    if (data.value?.since) params.set('since', data.value.since)
    if (data.value?.until) params.set('until', data.value.until)
    detail.value = await get(`/session?${params.toString()}`)
  } catch (err) {
    toast(err.message, 'error')
  } finally {
    loading.value = false
  }
}

watch(
  () => props.modelValue,
  (on) => {
    if (on) {
      note.value = tag.value.note || ''
      load()
    }
  }
)
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="1100"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="head">
        <span class="name">{{ title }}</span>
        <v-chip v-if="detail" size="small" variant="tonal">
          合计 ¥{{ fmtMoney(detail.totals.cost || 0) }}
        </v-chip>
        <v-btn
          :icon="tag.star ? 'mdi-star' : 'mdi-star-outline'"
          :color="tag.star ? 'primary' : undefined"
          size="small"
          variant="text"
          :title="tag.star ? '取消收藏' : '收藏会话'"
          @click="toggle('star')"
        />
        <v-btn
          :icon="tag.ignored ? 'mdi-eye-off' : 'mdi-eye'"
          size="small"
          variant="text"
          :title="tag.ignored ? '取消忽略' : '忽略会话'"
          @click="toggle('ignored')"
        />
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" @click="emit('update:modelValue', false)" />
      </v-card-title>
      <v-card-text class="body">
        <div v-if="loading" class="hint">正在读取请求明细…</div>
        <p v-else-if="!detail || !detail.rows.length" class="hint">这个会话在当前范围里没有记录。</p>
        <v-data-table
          v-else
          :headers="headers"
          :items="detail.rows"
          density="compact"
          :items-per-page="100"
          :items-per-page-options="[50, 100, 250, 500]"
          class="table"
        >
          <template v-for="column in headers" :key="column.key" #[`item.${column.key}`]="{ item }">
            <span :class="{ mono: column.key === 'model' }">{{ cell(item, column.key) }}</span>
          </template>
        </v-data-table>
        <v-text-field
          v-model="note"
          label="备注"
          density="compact"
          variant="outlined"
          class="note"
          hide-details
          @blur="saveNote"
        />
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.head {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.95rem;
}
.body {
  max-height: 70vh;
  overflow: auto;
}
.hint {
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.86rem;
}
.hint.bad {
  color: rgb(var(--v-theme-error));
}
.mono {
  font-family: 'JetBrains Mono', Roboto, 'Noto Sans SC', 'Source Han Sans SC', 'PingFang SC',
    'Microsoft YaHei', sans-serif;
}
.note {
  margin-top: 10px;
}
</style>
