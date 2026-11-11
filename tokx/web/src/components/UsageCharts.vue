<script setup>
import { computed } from 'vue'
import { data } from '../composables/useUsage'
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

// 按小时报表：24 个小时各自合计，柱子按该小时属于高峰还是空闲上色。
// 每一根柱子是某个小时里的某一行，"小时"这一列会重复，所以横轴带上模型与接口区分。
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

// 高峰号段从数据里推出来：某一小时的行标着高峰窗口，就说明它落在高峰号段里。
const windows = computed(() => {
  const list = []
  for (let hour = 0; hour < 24; hour += 1) {
    const slot = clock.value[hour]
    if (slot.peak) list.push([hour, Math.min(hour + 1, 23.5)])
  }
  return list
})

function shortApi(api) {
  if (!api || api === '-') return '无接口'
  try {
    return new URL(api).host
  } catch (err) {
    return api
  }
}

// 按小时报表的另一张：明细表每一行按时段画一根柱子。
const slots = computed(() =>
  (data.value?.rows || []).map((row) => ({
    label: `${row.slot}  ${row.model}  ${shortApi(row.api)}`,
    value: Number(row.cost) || 0,
    peak: row.label === '高峰窗口',
    tokens: row.total_tokens,
  })),
)
</script>

<template>
  <div class="charts">
    <!-- 标题与图例画在 canvas 里，见 BarChart 的 title / legend 参数。 -->
    <figure v-if="command === 'daily'">
      <BarChart :items="days" title="每天的费用（元）" />
    </figure>
    <figure v-else-if="command === 'hour'">
      <BarChart :items="clock" :windows="windows" title="24 小时合计费用（元）" legend="高峰窗口 / 空闲" />
    </figure>
    <figure v-if="command === 'hour'">
      <BarChart :items="slots" title="按小时分行的费用（元）" />
    </figure>
  </div>
</template>
