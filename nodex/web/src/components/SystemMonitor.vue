<template>
  <div class="monitor">
    <div v-for="item in series" :key="item.key" class="cell" :title="item.title">
      <div class="line">
        <span class="name">{{ item.name }}</span>
        <span class="value" :class="{ hot: item.now >= HOT }">{{ item.text }}</span>
      </div>
      <div :ref="(el) => setBox(item.key, el)" class="chart" />
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, reactive, watch } from 'vue'
import { init, use } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

use([LineChart, GridComponent, TooltipComponent, CanvasRenderer])

// 60 个点，5 秒一个，正好是最近 5 分钟。
const POINTS = 60
const HOT = 85

const props = defineProps({
  dark: { type: Boolean, default: false },
  metrics: { type: Object, default: null },
})

const COLORS = {
  light: { cpu: '#2563eb', mem: '#0d9488', disk: '#b45309', tip: '#ffffff', tipText: '#1d2129' },
  dark: { cpu: '#60a5fa', mem: '#2dd4bf', disk: '#fbbf24', tip: '#262a30', tipText: '#e5e7eb' },
}

const series = reactive([
  { key: 'cpu', name: 'CPU', now: null, text: '--', title: 'CPU 占用', data: [], labels: [] },
  { key: 'mem', name: '内存', now: null, text: '--', title: '内存占用', data: [], labels: [] },
  { key: 'disk', name: '磁盘', now: null, text: '--', title: '磁盘占用', data: [], labels: [] },
])

const boxes = {}
const charts = {}
let observer = null

function setBox(key, el) {
  if (el) boxes[key] = el
}

function palette() {
  return COLORS[props.dark ? 'dark' : 'light']
}

function option(item) {
  const color = palette()[item.key]
  return {
    animation: false,
    grid: { left: 1, right: 1, top: 3, bottom: 1 },
    xAxis: { type: 'category', show: false, boundaryGap: false, data: item.labels.slice() },
    yAxis: { type: 'value', show: false, min: 0, max: 100 },
    tooltip: {
      trigger: 'axis',
      confine: true,
      backgroundColor: palette().tip,
      borderWidth: 0,
      padding: [4, 8],
      textStyle: { color: palette().tipText, fontSize: 12, fontFamily: 'Roboto, sans-serif' },
      formatter: (ps) => `${item.name} ${ps[0].axisValue}　${ps[0].value}%`,
    },
    series: [
      {
        type: 'line',
        data: item.data.slice(),
        showSymbol: false,
        smooth: 0.25,
        lineStyle: { width: 1.5, color },
        areaStyle: { opacity: 0.16, color },
      },
    ],
  }
}

// 头部在窄屏下整块隐藏，隐藏时容器宽度为 0，等它露出来再初始化。
function build(key) {
  const el = boxes[key]
  const item = series.find((row) => row.key === key)
  if (!el || !item || !el.clientWidth) return
  if (charts[key]) charts[key].dispose()
  charts[key] = init(el, null, { renderer: 'canvas' })
  charts[key].setOption(option(item))
}

function clock(seconds) {
  return new Date(seconds * 1000).toLocaleTimeString('zh-CN', { hour12: false })
}

function apply(data) {
  const label = clock(data.time)
  const values = {
    cpu: data.cpu,
    mem: data.mem && data.mem.percent,
    disk: data.disk && data.disk.percent,
  }
  if (data.disk && data.disk.mount) {
    const disk = series.find((row) => row.key === 'disk')
    disk.title = `磁盘占用（${data.disk.mount}）`
  }
  for (const item of series) {
    const value = values[item.key]
    if (typeof value !== 'number') {
      item.now = null
      item.text = '--'
      continue
    }
    item.now = value
    item.text = `${Math.round(value)}%`
    item.data.push(value)
    item.labels.push(label)
    if (item.data.length > POINTS) {
      item.data.shift()
      item.labels.shift()
    }
    if (charts[item.key]) {
      charts[item.key].setOption({
        xAxis: { data: item.labels.slice() },
        series: [{ data: item.data.slice() }],
      })
    }
  }
}

// 数据从页面的那条 SSE 上带过来，这里只管画。
watch(
  () => props.metrics,
  (data) => {
    if (data) apply(data)
  },
  { immediate: true },
)

onMounted(() => {
  observer = new ResizeObserver(() => {
    for (const item of series) {
      const el = boxes[item.key]
      if (!el || !el.clientWidth) continue
      if (charts[item.key]) charts[item.key].resize()
      else build(item.key)
    }
  })
  for (const item of series) {
    if (boxes[item.key]) observer.observe(boxes[item.key])
  }
})

onBeforeUnmount(() => {
  if (observer) observer.disconnect()
  for (const key in charts) charts[key].dispose()
})

// 深浅色切换：整份配置重画，线条与提示框跟着换色。
watch(
  () => props.dark,
  () => {
    for (const item of series) {
      if (charts[item.key]) charts[item.key].setOption(option(item), true)
    }
  }
)
</script>

<style scoped>
.monitor {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-right: 16px;
  flex: 0 0 auto;
}
.cell {
  width: 92px;
}
.line {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px;
  line-height: 1;
}
.name {
  font-size: 0.68rem;
  color: rgb(var(--v-theme-on-surface-variant));
}
.value {
  font-size: 0.74rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.value.hot {
  color: rgb(var(--v-theme-error));
}
.chart {
  height: 26px;
  margin-top: 2px;
}
@media (max-width: 960px) {
  .monitor {
    display: none;
  }
}
</style>
