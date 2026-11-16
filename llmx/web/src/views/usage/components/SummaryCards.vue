<script setup>
import { computed } from 'vue'
import { data } from '../composables/useUsage'
import { fmtMoney, fmtNum, fmtTokens } from '../composables/format'

// 六个格子对应报表合计的口径，最后一格强调。
const items = computed(() => {
  const totals = data.value?.totals || {}
  const hit = totals.cache_hit
  const saved = totals.cache_saved
  return [
    { title: '请求', value: fmtNum(totals.requests), icon: 'mdi-counter' },
    { title: '总 token', value: fmtTokens(totals.total_tokens), icon: 'mdi-vector-triangle' },
    {
      title: hit == null ? '缓存节省' : `缓存节省 · 命中 ${(hit * 100).toFixed(0)}%`,
      value: saved == null ? '--' : `¥${fmtMoney(saved)}`,
      icon: 'mdi-database-check',
    },
    { title: '高峰费用', value: `¥${fmtMoney(totals.cost_peak || 0)}`, icon: 'mdi-finance' },
    { title: '空闲费用', value: `¥${fmtMoney(totals.cost_off || 0)}`, icon: 'mdi-cash-100' },
    { title: '合计', value: `¥${fmtMoney(totals.cost || 0)}`, icon: 'mdi-sigma', strong: true },
  ]
})
</script>

<template>
  <v-row dense>
    <v-col v-for="item in items" :key="item.title" cols="12" sm="6" md="4" lg>
      <v-card :variant="item.strong ? 'tonal' : 'flat'" :color="item.strong ? 'primary' : undefined">
        <v-card-item>
          <template #prepend>
            <v-icon :icon="item.icon" :color="item.strong ? 'primary' : 'on-surface-variant'" />
          </template>
          <v-card-subtitle>{{ item.title }}</v-card-subtitle>
          <v-card-title class="number">{{ item.value }}</v-card-title>
        </v-card-item>
      </v-card>
    </v-col>
  </v-row>
</template>

<style scoped>
.number {
  font-variant-numeric: tabular-nums;
  font-size: 1.35rem;
}

/* 图标列占满卡片高度并贴顶，与右侧标题、数字的起点对齐。 */
:deep(.v-card-item__prepend) {
  align-self: stretch;
  height: 100%;
  align-items: flex-start;
}
</style>
