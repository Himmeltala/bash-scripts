<script setup>
import { computed } from 'vue'
import { data } from '../composables/useUsage'
import { fmtMoney, fmtNum, fmtTokens } from '../composables/format'

const items = computed(() => {
  const totals = data.value?.totals || {}
  return [
    { k: '请求', v: fmtNum(totals.requests) },
    { k: '总 token', v: fmtTokens(totals.total_tokens) },
    { k: '高峰费用', v: `¥${fmtMoney(totals.cost_peak || 0)}` },
    { k: '空闲费用', v: `¥${fmtMoney(totals.cost_off || 0)}` },
    { k: '合计', v: `¥${fmtMoney(totals.cost || 0)}`, strong: true },
  ]
})
</script>

<template>
  <section class="cards" aria-label="合计">
    <div v-for="item in items" :key="item.k" class="card" :class="{ strong: item.strong }">
      <span class="k">{{ item.k }}</span>
      <span class="v">{{ item.v }}</span>
    </div>
  </section>
</template>
