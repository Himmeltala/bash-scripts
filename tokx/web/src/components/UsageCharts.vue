<script setup>
import { computed } from 'vue'
import { data } from '../composables/useUsage'
import { SOURCE_LIST } from '../composables/format'
import BarChart from './BarChart.vue'

const command = computed(() => data.value?.command)

// 按天报表：每天合计费用。
const days = computed(() => {
  const sums = new Map()
  for (const row of data.value?.rows || []) {
    sums.set(row.date, (sums.get(row.date) || 0) + (Number(row.cost) || 0))
  }
  return [...sums.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, value]) => ({ label: label.slice(5), value }))
})

// 按小时报表的左上图：24 个小时各自合计，柱子按该小时属于高峰还是空闲上色。
const clock = computed(() => {
  const sums = Array.from({ length: 24 }, () => ({ value: 0, tokens: 0, peak: false }))
  for (const row of data.value?.rows || []) {
    const slot = sums[row.hour]
    if (!slot) continue
    slot.value += Number(row.cost) || 0
    slot.tokens += Number(row.total_tokens) || 0
    if (row.label === '高峰窗口') slot.peak = true
  }
  return sums.map((slot, hour) => ({ label: `${String(hour).padStart(2, '0')}:00`, ...slot }))
})

// 按小时报表的右下图：同一个小时里各来源（harness）分别花了多少，颜色区分来源。
// 横轴与左图一样是 0 到 23 点，同一个小时位置上左图是一根合计柱，右图是按来源并排的几根。
const harness = computed(() => {
  const rows = data.value?.rows || []
  const sums = new Map()
  for (const row of rows) {
    const slot = sums.get(row.hour) || new Map()
    slot.set(row.source, (slot.get(row.source) || 0) + (Number(row.cost) || 0))
    sums.set(row.hour, slot)
  }
  const hours = Array.from({ length: 24 }, (_, hour) => hour)
  return {
    categories: hours.map((hour) => `${String(hour).padStart(2, '0')}:00`),
    series: SOURCE_LIST.filter((item) => rows.some((row) => row.source === item.key)).map((item) => ({
      name: item.name,
      color: item.color,
      data: hours.map((hour) => {
        const cost = sums.get(hour)?.get(item.key)
        return cost == null ? null : Number(cost.toFixed(6))
      }),
    })),
  }
})
</script>

<template>
  <v-row dense>
    <v-col v-if="command === 'daily'" cols="12">
      <v-card variant="outlined">
        <BarChart :items="days" title="每天的费用（元）" />
      </v-card>
    </v-col>
    <v-col v-if="command === 'hour'" cols="12" lg="6">
      <v-card variant="outlined">
        <BarChart :items="clock" title="每小时合计费用（元）" legend />
      </v-card>
    </v-col>
    <v-col v-if="command === 'hour'" cols="12" lg="6">
      <v-card variant="outlined">
        <BarChart
          :categories="harness.categories"
          :series="harness.series"
          title="每小时各来源的费用（元）"
          legend
        />
      </v-card>
    </v-col>
  </v-row>
</template>
