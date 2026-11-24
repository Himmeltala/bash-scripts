<script setup>
import { computed } from 'vue'
import { FloatingDialog } from '@bash-scripts/web-shared/feedbacks'
import { data } from '../composables/useUsage'
import { fmtMoney, fmtNum, fmtTokens } from '../lib/format'
import CostBreakdown from './CostBreakdown.vue'

defineProps({
  modelValue: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])

const totals = computed(() => data.value?.totals || {})
const requests = computed(() => Number(totals.value.requests) || 0)

// 无价模型只算 token 不算钱，平均费用只除已计价的请求，免得把平均值拉低。
const pricedRequests = computed(() =>
  (data.value?.rows || []).reduce(
    (sum, row) => sum + Math.max(0, (Number(row.requests) || 0) - (Number(row.unpriced) || 0)),
    0,
  ),
)

const money = (value) => (value == null ? '--' : `¥${fmtMoney(value)}`)
const tokens = (value) => (value == null ? '--' : fmtTokens(value))
const perRequest = (value, base) => (base > 0 && value != null ? Number(value) / base : null)

const averages = computed(() => {
  const t = totals.value
  return [
    { label: '费用', value: money(perRequest(t.cost, pricedRequests.value)) },
    { label: '总 token', value: tokens(perRequest(t.total_tokens, requests.value)) },
    { label: '输入', value: tokens(perRequest(t.input, requests.value)) },
    { label: '缓存读', value: tokens(perRequest(t.cache_read, requests.value)) },
    { label: '缓存写', value: tokens(perRequest(t.cache_write, requests.value)) },
    { label: '输出', value: tokens(perRequest(t.output, requests.value)) },
    { label: '高峰费用', value: money(perRequest(t.cost_peak, pricedRequests.value)) },
    { label: '空闲费用', value: money(perRequest(t.cost_off, pricedRequests.value)) },
  ]
})

const summaries = computed(() => {
  const t = totals.value
  const hit = t.cache_hit
  return [
    { label: '请求', value: fmtNum(t.requests) },
    { label: '输入', value: fmtNum(t.input) },
    { label: '缓存读', value: fmtNum(t.cache_read) },
    { label: '缓存写', value: fmtNum(t.cache_write) },
    { label: '输出', value: fmtNum(t.output) },
    { label: '总 token', value: fmtNum(t.total_tokens) },
    { label: '缓存命中', value: hit == null ? '--' : `${(hit * 100).toFixed(1)}%` },
    { label: '缓存节省', value: money(t.cache_saved) },
    { label: '高峰费用', value: money(t.cost_peak) },
    { label: '空闲费用', value: money(t.cost_off) },
    { label: '合计', value: money(t.cost) },
  ]
})
</script>

<template>
  <FloatingDialog
    :model-value="modelValue"
    :initial-width="720"
    :initial-height="580"
    :min-width="460"
    :min-height="360"
    storage-key="usage-metrics"
    storage="llmx.dialog-layouts"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #title>指标详情</template>

    <template v-if="data">
      <h3 class="section">平均（每请求）</h3>
      <div class="grid">
        <div v-for="item in averages" :key="item.label" class="cell">
          <span class="label">{{ item.label }}</span>
          <span class="value">{{ item.value }}</span>
        </div>
      </div>
      <h3 class="section">汇总</h3>
      <div class="grid">
        <div v-for="item in summaries" :key="item.label" class="cell">
          <span class="label">{{ item.label }}</span>
          <span class="value">{{ item.value }}</span>
        </div>
      </div>

      <h3 class="section">费用构成</h3>
      <CostBreakdown />
    </template>
    <p v-else class="note">还没有数据。</p>

    <template #actions>
      <v-spacer />
      <v-btn variant="text" @click="emit('update:modelValue', false)">关闭</v-btn>
    </template>
  </FloatingDialog>
</template>

<style scoped>
.section {
  margin: 0.9rem 0 0.4rem;
  font-size: 0.9rem;
  font-weight: 600;
}

.section:first-child {
  margin-top: 0;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0 1.2rem;
}

.cell {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.8rem;
  padding: 0.28rem 0;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.label {
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.85rem;
}

.value {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  white-space: nowrap;
}

.note {
  margin: 0.5rem 0 0;
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.78rem;
}
</style>
