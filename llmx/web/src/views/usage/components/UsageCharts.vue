<script setup>
import { computed } from 'vue'
import { useStoredChoice } from '@bash-scripts/web-shared'
import { useTheme } from 'vuetify'
import { data } from '../composables/useUsage'
import { SOURCE_LIST } from '../composables/format'
import BarChart from './BarChart.vue'
import CostCalendar from './CostCalendar.vue'
import FlowSankey from './FlowSankey.vue'

const command = computed(() => data.value?.command)
const rows = computed(() => data.value?.rows || [])

// 图表一次只显示选中的一种；日历只属于按天，桑基只在有来源流向的报表里给。
const MODE_ITEMS = [
  { value: 'bar', label: '柱状图', icon: 'mdi-chart-bar' },
  { value: 'stacked', label: '堆叠图', icon: 'mdi-chart-timeline-variant' },
  { value: 'line', label: '折线图', icon: 'mdi-chart-line' },
  { value: 'donut', label: '环形图', icon: 'mdi-chart-donut' },
  { value: 'heatmap', label: '热力图', icon: 'mdi-grid' },
  { value: 'unit', label: '单位成本', icon: 'mdi-currency-usd' },
  { value: 'calendar', label: '日历', icon: 'mdi-calendar' },
  { value: 'sankey', label: '桑基图', icon: 'mdi-transit-connection-variant' },
]
const MAIN_MODES = ['bar', 'stacked', 'line', 'donut', 'heatmap']

const availableItems = computed(() =>
  MODE_ITEMS.filter((item) => {
    if (item.value === 'calendar') return command.value === 'daily'
    if (item.value === 'sankey') return command.value !== 'hour'
    return true
  })
)

// 选择记在浏览器里；换到没有这种图的报表时按柱状图显示。
const savedMode = useStoredChoice(
  'llmx.chart-mode',
  MODE_ITEMS.map((item) => item.value),
  'bar',
)
const chartMode = computed({
  get: () =>
    availableItems.value.some((item) => item.value === savedMode.value) ? savedMode.value : 'bar',
  set: (value) => {
    savedMode.value = value
  },
})
const isMain = computed(() => MAIN_MODES.includes(chartMode.value))

// 桑基图的末级：API 报表按接口归，其余按项目归。
const flowTarget = computed(() =>
  command.value === 'api' ? { key: 'api', label: 'API' } : { key: 'project', label: '项目' }
)

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

// 按会话报表的图：取费用最高的前 12 个会话，各来源分别花了多少。
const sessionChart = computed(() => {
  const money = new Map()
  for (const row of rows.value) {
    const name = row.session || '未记录'
    money.set(name, (money.get(name) || 0) + (Number(row.cost) || 0))
  }
  const top = [...money.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([name]) => name)
  return split(top, (row) => row.session || '未记录')
})

// 按项目报表的图：取费用最高的前 12 个项目，各来源分别花了多少。
const projectChart = computed(() => {
  const money = new Map()
  for (const row of rows.value) {
    const name = row.project || '未记录'
    money.set(name, (money.get(name) || 0) + (Number(row.cost) || 0))
  }
  const top = [...money.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([name]) => name)
  return split(top, (row) => row.project || '未记录')
})

// 单位成本：每千 token 花多少钱。按当前报表的横轴刻度聚合，不区分来源。
const theme = useTheme()

function shortSession(value) {
  const text = value || '未记录'
  return text.length > 12 ? `${text.slice(0, 10)}..` : text
}

const unitChart = computed(() => {
  let categories = []
  let keyOf = () => ''
  let labelOf = (value) => value
  if (command.value === 'daily') {
    categories = days.value.categories
    keyOf = (row) => row.date
    labelOf = (value) => value.slice(5)
  } else if (command.value === 'hour') {
    categories = clock.value.map((item) => item.label)
    keyOf = (row) => `${String(row.hour).padStart(2, '0')}:00`
  } else if (command.value === 'session') {
    categories = sessionChart.value.categories
    keyOf = (row) => row.session || '未记录'
    labelOf = shortSession
  } else if (command.value === 'project') {
    categories = projectChart.value.categories
    keyOf = (row) => row.project || '未记录'
  } else {
    categories = apiChart.value.categories
    keyOf = (row) => row.api || '未记录'
  }
  const cost = new Map()
  const tokens = new Map()
  for (const row of rows.value) {
    const key = keyOf(row)
    cost.set(key, (cost.get(key) || 0) + (Number(row.cost) || 0))
    tokens.set(key, (tokens.get(key) || 0) + (Number(row.total_tokens) || 0))
  }
  const data = categories.map((key) => {
    const total = tokens.get(key) || 0
    if (!total) return null
    return Number((((cost.get(key) || 0) / total) * 1000).toFixed(6))
  })
  return {
    categories: categories.map(labelOf),
    series: [
      {
        name: '每千 token 费用',
        color: theme.current.value.colors.primary,
        data,
      },
    ],
  }
})

// 按 API 报表的图：取费用最高的前 12 个接口地址，各来源分别花了多少。
const apiChart = computed(() => {
  const money = new Map()
  for (const row of rows.value) {
    const name = row.api || '未记录'
    money.set(name, (money.get(name) || 0) + (Number(row.cost) || 0))
  }
  const top = [...money.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([name]) => name)
  return split(top, (row) => row.api || '未记录')
})
</script>

<template>
  <v-card variant="flat" class="chart-card">
    <div class="chart-bar">
      <v-btn-toggle v-model="chartMode" mandatory density="compact" variant="outlined" divided>
        <v-btn
          v-for="item in availableItems"
          :key="item.value"
          :value="item.value"
          size="small"
          :prepend-icon="item.icon"
        >
          {{ item.label }}
        </v-btn>
      </v-btn-toggle>
    </div>
    <v-row dense>
      <v-col v-if="isMain && command === 'api'" cols="12">
        <BarChart
          :categories="apiChart.categories"
          :series="apiChart.series"
          :mode="chartMode"
          title="各 API 费用（元）"
          legend
        />
      </v-col>
      <v-col v-if="isMain && command === 'session'" cols="12">
        <BarChart
          :categories="sessionChart.categories.map((name) => (name.length > 12 ? `${name.slice(0, 10)}..` : name))"
          :series="sessionChart.series"
          :mode="chartMode"
          title="各会话费用（元）"
          legend
        />
      </v-col>
      <v-col v-if="isMain && command === 'project'" cols="12">
        <BarChart
          :categories="projectChart.categories"
          :series="projectChart.series"
          :mode="chartMode"
          title="各项目费用（元）"
          legend
        />
      </v-col>
      <v-col v-if="isMain && command === 'daily'" cols="12">
        <BarChart
          :categories="shortDays.categories"
          :series="shortDays.series"
          :mode="chartMode"
          title="每天各来源的费用（元）"
          legend
        />
      </v-col>
      <v-col v-if="chartMode === 'unit'" cols="12">
        <BarChart
          :categories="unitChart.categories"
          :series="unitChart.series"
          :digits="4"
          title="每千 token 费用（元）"
          legend
        />
      </v-col>
      <v-col v-if="command === 'daily' && chartMode === 'calendar'" cols="12">
        <CostCalendar :rows="rows" />
      </v-col>
      <v-col v-if="command !== 'hour' && chartMode === 'sankey'" cols="12">
        <FlowSankey
          :rows="rows"
          :target-key="flowTarget.key"
          :target-label="flowTarget.label"
        />
      </v-col>
      <v-col v-if="isMain && command === 'hour'" cols="12" lg="6">
        <BarChart :items="clock" :mode="chartMode" title="每小时合计费用（元）" legend />
      </v-col>
      <v-col v-if="isMain && command === 'hour'" cols="12" lg="6">
        <BarChart
          :categories="clockBySource.categories"
          :series="clockBySource.series"
          :mode="chartMode"
          title="每小时各来源的费用（元）"
          legend
        />
      </v-col>
    </v-row>
  </v-card>
</template>

<style scoped>
.chart-card {
  padding: 12px 12px 4px;
}

.chart-bar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 4px;
}
</style>
