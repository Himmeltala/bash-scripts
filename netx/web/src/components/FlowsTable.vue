<script setup>
import { computed, ref } from 'vue'
import { EmptyState } from '@bash-scripts/web-shared/ui'
import { formatBytes } from '@bash-scripts/web-shared/format'
import { formatDuration, formatTarget, formatTime } from '../utils/format'

const props = defineProps({
  rows: { type: Array, default: () => [] },
  total: { type: Number, default: 0 },
  loading: { type: Boolean, default: false },
  rangeLabel: { type: String, default: '' },
})

const headers = [
  { title: '开始', key: 'started', width: 156 },
  { title: '进程', key: 'comm', width: 160 },
  { title: 'PID', key: 'pid', align: 'end', width: 96 },
  { title: '目标', key: 'dst_ip', width: 240 },
  { title: '发送', key: 'bytes_out', align: 'end', width: 110 },
  { title: '时长', key: 'duration', align: 'end', width: 100 },
  { title: '状态', key: 'ended', width: 96, sortable: false },
]

const sortBy = ref([{ key: 'started', order: 'desc' }])

const filtered = computed(() => props.rows.length < props.total)
const countText = computed(() =>
  filtered.value
    ? '显示 ' + props.rows.length + ' / 共 ' + props.total + ' 条'
    : '共 ' + props.rows.length + ' 条',
)

const bytes = (value) =>
  formatBytes(value, { units: ['B', 'KB', 'MB', 'GB'], precision: [0, 1, 2, 2] })
</script>

<template>
  <v-card variant="flat" class="table-card">
    <div class="table-head">
      <span class="table-title">出网连接</span>
      <span class="table-meta">{{ countText }} · {{ rangeLabel }}</span>
    </div>
    <v-data-table
      v-model:sort-by="sortBy"
      :headers="headers"
      :items="rows"
      item-value="id"
      :loading="loading"
      loading-text="正在读取连接…"
      density="compact"
      hover
      fixed-header
      :items-per-page="-1"
      hide-default-footer
      height="100%"
      class="table"
    >
      <template #[`item.started`]="{ item }">{{ formatTime(item.started) }}</template>
      <template #[`item.comm`]="{ item }">
        <span class="comm" :title="item.exe || item.comm">{{ item.comm || '-' }}</span>
      </template>
      <template #[`item.pid`]="{ item }">{{ item.pid }}</template>
      <template #[`item.dst_ip`]="{ item }">
        <span class="mono">{{ formatTarget(item) }}</span>
      </template>
      <template #[`item.bytes_out`]="{ item }">{{ bytes(item.bytes_out) }}</template>
      <template #[`item.duration`]="{ item }">{{ formatDuration(item.duration) }}</template>
      <template #[`item.ended`]="{ item }">
        <v-chip size="x-small" variant="tonal" :color="item.ended ? undefined : 'live'">
          {{ item.ended ? '已结束' : '进行中' }}
        </v-chip>
      </template>

      <template #no-data>
        <EmptyState
          :icon="filtered ? 'mdi-filter-remove-outline' : 'mdi-lan-disconnect'"
          :title="filtered ? '没有匹配的记录' : '这段时间没有出网记录'"
          :hint="
            filtered
              ? '换个关键词或时间范围再试。'
              : '采集在跑时会自动推过来；也可以把时间范围放宽。'
          "
          :hint-width="360"
        />
      </template>
    </v-data-table>
  </v-card>
</template>

<style scoped>
.table-card {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.table-head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 12px 16px 8px;
}
.table-title {
  font-size: 1rem;
  font-weight: 600;
}
.table-meta {
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.82rem;
}
.table {
  flex: 1 1 auto;
  min-height: 0;
}
.comm {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mono {
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 0.86em;
}
</style>
