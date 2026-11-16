<script setup>
import { computed, ref } from 'vue'
import { data } from '../composables/useUsage'
import { fmtMoney, fmtNum, fmtTokens } from '../composables/format'
import MetricsDialog from './MetricsDialog.vue'

const details = ref(false)

// 四张卡片只留最常看的数，其余指标与各项平均收进详情弹窗。
const items = computed(() => {
  const totals = data.value?.totals || {}
  const requests = Number(totals.requests) || 0
  const priced = (data.value?.rows || []).reduce(
    (sum, row) => sum + Math.max(0, (Number(row.requests) || 0) - (Number(row.unpriced) || 0)),
    0,
  )
  const average = totals.cost == null || !priced ? null : Number(totals.cost) / priced
  return [
    { title: '请求', value: fmtNum(totals.requests), icon: 'mdi-counter' },
    { title: '总 token', value: fmtTokens(totals.total_tokens), icon: 'mdi-vector-triangle' },
    {
      title: '平均每请求费用',
      value: average == null ? '--' : `¥${average.toLocaleString('zh-CN', {
        minimumFractionDigits: 4,
        maximumFractionDigits: 4,
      })}`,
      icon: 'mdi-scale-balance',
    },
    { title: '合计', value: `¥${fmtMoney(totals.cost || 0)}`, icon: 'mdi-sigma', strong: true },
  ]
})
</script>

<template>
  <div>
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
      <v-col cols="12" sm="6" md="4" lg>
        <v-card
          variant="flat"
          class="more"
          role="button"
          tabindex="0"
          @click="details = true"
          @keydown.enter="details = true"
          @keydown.space.prevent="details = true"
        >
          <v-card-item>
            <template #prepend>
              <v-icon icon="mdi-chart-box-outline" color="on-surface-variant" />
            </template>
            <v-card-subtitle>更多指标</v-card-subtitle>
            <v-card-title class="number">查看详情</v-card-title>
          </v-card-item>
        </v-card>
      </v-col>
    </v-row>
    <MetricsDialog v-model="details" />
  </div>
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

.more {
  cursor: pointer;
  transition: background-color 0.15s;
}

.more:hover {
  background: rgb(var(--v-theme-surface-variant));
}
</style>
