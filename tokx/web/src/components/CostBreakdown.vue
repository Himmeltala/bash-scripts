<script setup>
import { computed } from 'vue'
import { data } from '../composables/useUsage'
import { fmtMoney } from '../composables/format'

// 费用按 token 类别拆开：输入未命中、缓存读、缓存写、输出。
const PARTS = [
  { key: 'cost_input', name: '输入未命中', color: '#3b82f6' },
  { key: 'cost_cache_read', name: '缓存读', color: '#22c55e' },
  { key: 'cost_cache_write', name: '缓存写', color: '#f59e0b' },
  { key: 'cost_output', name: '输出', color: '#ef4444' },
]

const parts = computed(() => {
  const totals = data.value?.totals || {}
  const rows = PARTS.map((part) => ({ ...part, value: Number(totals[part.key]) || 0 }))
  return { rows, amount: rows.reduce((sum, row) => sum + row.value, 0) }
})

const percent = (value) => (parts.value.amount ? (value / parts.value.amount) * 100 : 0)
</script>

<template>
  <v-card v-if="parts.amount > 0" variant="flat" class="pa-3">
    <div class="head">
      <span class="title">费用构成</span>
      <span class="total">¥{{ fmtMoney(parts.amount) }}</span>
    </div>
    <div class="bar">
      <span
        v-for="part in parts.rows"
        :key="part.key"
        class="seg"
        :style="{ flexGrow: part.value, background: part.color }"
        :title="`${part.name} ¥${fmtMoney(part.value)}`"
      />
    </div>
    <div class="legend">
      <span v-for="part in parts.rows" :key="part.key" class="item">
        <i :style="{ background: part.color }" />
        {{ part.name }} ¥{{ fmtMoney(part.value) }}
        <em>{{ percent(part.value).toFixed(0) }}%</em>
      </span>
    </div>
  </v-card>
</template>

<style scoped>
.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.title {
  font-size: 0.9rem;
  font-weight: 600;
}

.total {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.bar {
  display: flex;
  height: 10px;
  overflow: hidden;
  border-radius: 5px;
  background: rgb(var(--v-theme-surface-variant));
}

.seg {
  flex-basis: 0;
  min-width: 0;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 1rem;
  margin-top: 0.55rem;
  font-size: 0.78rem;
  color: rgb(var(--v-theme-on-surface-variant));
}

.item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.item i {
  display: inline-block;
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 2px;
}

.item em {
  font-style: normal;
  opacity: 0.7;
}
</style>
