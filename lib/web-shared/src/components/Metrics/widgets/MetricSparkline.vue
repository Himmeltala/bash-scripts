<template>
  <div class="metric-cell" :title="title">
    <div class="line">
      <span class="name">{{ name }}</span>
      <span class="value" :class="{ hot: isHot }">{{ text }}</span>
    </div>
    <div ref="boxRef" class="chart" />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { init, use } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { METRIC_COLORS } from '../palette.js'

use([LineChart, GridComponent, TooltipComponent, CanvasRenderer])

const props = defineProps({
  name: { type: String, required: true },
  title: { type: String, default: '' },
  value: { type: Number, default: null },
  time: { type: Number, default: null },
  color: { type: String, default: 'cpu' },
  hot: { type: Number, default: 85 },
  dark: { type: Boolean, default: false },
  points: { type: Number, default: 60 },
})

const boxRef = ref(null)
const now = ref(null)
const text = ref('--')
const data = []
const labels = []
let chart = null
let observer = null

const isHot = computed(() => now.value !== null && now.value >= props.hot)

function palette() {
  return METRIC_COLORS[props.dark ? 'dark' : 'light']
}

function option() {
  const p = palette()
  // color 可以是调色板里的键，也可以直接给一个 CSS 颜色。
  const color = p[props.color] || props.color || p.cpu
  return {
    animation: false,
    grid: { left: 1, right: 1, top: 3, bottom: 1 },
    xAxis: { type: 'category', show: false, boundaryGap: false, data: labels.slice() },
    yAxis: { type: 'value', show: false, min: 0, max: 100 },
    tooltip: {
      trigger: 'axis',
      confine: true,
      backgroundColor: p.tip,
      borderWidth: 0,
      padding: [4, 8],
      textStyle: { color: p.tipText, fontSize: 12, fontFamily: 'Roboto, sans-serif' },
      formatter: (ps) => `${props.name} ${ps[0].axisValue}　${ps[0].value}%`,
    },
    series: [
      {
        type: 'line',
        data: data.slice(),
        showSymbol: false,
        smooth: 0.25,
        lineStyle: { width: 1.5, color },
        areaStyle: { opacity: 0.16, color },
      },
    ],
  }
}

// 头部在窄屏下整块隐藏，隐藏时容器宽度为 0，等它露出来再初始化。
function build() {
  const el = boxRef.value
  if (!el || !el.clientWidth) return
  if (chart) chart.dispose()
  chart = init(el, null, { renderer: 'canvas' })
  chart.setOption(option())
}

function clock(seconds) {
  return new Date(seconds * 1000).toLocaleTimeString('zh-CN', { hour12: false })
}

watch(
  () => [props.time, props.value],
  ([time, value]) => {
    if (!time) return
    if (typeof value !== 'number') {
      now.value = null
      text.value = '--'
      return
    }
    now.value = value
    text.value = `${Math.round(value)}%`
    data.push(value)
    labels.push(clock(time))
    if (data.length > props.points) {
      data.shift()
      labels.shift()
    }
    if (chart) {
      chart.setOption({
        xAxis: { data: labels.slice() },
        series: [{ data: data.slice() }],
      })
    }
  },
  { immediate: true },
)

onMounted(() => {
  observer = new ResizeObserver(() => {
    const el = boxRef.value
    if (!el || !el.clientWidth) return
    if (chart) chart.resize()
    else build()
  })
  if (boxRef.value) observer.observe(boxRef.value)
})

onBeforeUnmount(() => {
  if (observer) observer.disconnect()
  if (chart) chart.dispose()
})

// 深浅色切换：整份配置重画，线条与提示框跟着换色。
watch(
  () => props.dark,
  () => {
    if (chart) chart.setOption(option(), true)
  },
)
</script>

<style scoped src="./MetricSparkline.css"></style>
