<script setup>
import { computed } from 'vue'
import { data } from '../composables/useUsage'
import { SOURCE_LIST } from '../composables/format'
import BarChart from './BarChart.vue'

const command = computed(() => data.value?.command)
const rows = computed(() => data.value?.rows || [])

// 把行按横轴刻度与来源摊平：返回刻度列表与每个来源一条系列，颜色区分来源。
function split(categories, keyOf) {
  const wants = new Set(categories)
  const sums = new Map()
  for (const row of rows.value) {
    const at = keyOf(row)
    if (!wants.has(at)) continue
    const slot = sums.get(at) || new Map()
    slot.set(row.source, (slot.get(row.source) || 0) + (Number(row.cost) || 0))
    sums.set(at, slot)
  }
  return {
    categories,
    series: SOURCE_LIST.filter((item) => rows.value.some((row) => row.source === item.key)).map((item) => ({
      name: item.name,
      color: item.color,
      data: categories.map((at) => {
        const cost = sums.get(at)?.get(item.key)
        return cost == null ? null : Number(cost.toFixed(6))
      }),
    })),
  }
}

// 按天报表的图：每天里各来源（harness）分别花了多少，颜色区分来源。
const days = computed(() => {
  const labels = [...new Set(rows.value.map((row) => row.date))].sort((a, b) => a.localeCompare(b))
  return split(labels, (row) => row.date)
})

// 按小时报表的左上图：24 个小时各自合计，柱子按该小时属于高峰还是空闲上色。
const clock = computed(() => {
  const sums = Array.from({ length: 24 }, () => ({ value: 0, tokens: 0, peak: false }))
  for (const row of rows.value) {
    const slot = sums[row.hour]
    if (!slot) continue
    slot.value += Number(row.cost) || 0
    slot.tokens += Number(row.total_tokens) || 0
    if (row.label === '高峰窗口') slot.peak = true
  }
  return sums.map((slot, hour) => ({ label: `${String(hour).padStart(2, '0')}:00`, ...slot }))
})

// 按小时报表的右下图：同一个小时里各来源分别花了多少。
// 横轴与左图一样是 0 到 23 点，同一个小时位置上左图是一根合计柱，右图是按来源并排的几根。
const clockBySource = computed(() => {
  const hours = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, '0')}:00`)
  return split(hours, (row) => `${String(row.hour).padStart(2, '0')}:00`)
})

// 按天报表的横轴只写月-日，年份在筛选范围里已经说明了。
const shortDays = computed(() => ({
  categories: days.value.categories.map((label) => label.slice(5)),
  series: days.value.series,
}))
</script>

<template>
  <v-row dense>
    <v-col v-if="command === 'daily'" cols="12">
      <v-card variant="outlined">
        <BarChart
          :categories="shortDays.categories"
          :series="shortDays.series"
          title="每天各来源的费用（元）"
          legend
        />
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
          :categories="clockBySource.categories"
          :series="clockBySource.series"
          title="每小时各来源的费用（元）"
          legend
        />
      </v-card>
    </v-col>
  </v-row>
</template>
