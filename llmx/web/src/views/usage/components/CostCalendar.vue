<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts/core'
import { HeatmapChart } from 'echarts/charts'
import { CalendarComponent, TooltipComponent, VisualMapComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useTheme } from 'vuetify'
import { fmtMoney } from '../composables/format'

const FONT = 'Roboto, sans-serif'

echarts.use([HeatmapChart, CalendarComponent, TooltipComponent, VisualMapComponent, CanvasRenderer])

const props = defineProps({
  // 按天报表的行：date 是 YYYY-MM-DD，cost 是当天费用。
  rows: { type: Array, default: () => [] },
  title: { type: String, default: '每日费用日历（元）' },
  height: { type: Number, default: 240 },
})

const box = ref(null)
let chart = null
let watcher = null

const theme = useTheme()
const colors = computed(() => theme.current.value.colors)
const dark = computed(() => theme.current.value.dark)

function fade(color, alpha) {
  const text = String(color || '')
  if (!text.startsWith('#')) return text
  let hex = text.slice(1)
  if (hex.length === 3) hex = hex.split('').map((ch) => ch + ch).join('')
  const value = Number.parseInt(hex, 16)
  if (Number.isNaN(value)) return text
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`
}

// 同一天可能有多行（不同来源），先按日期合计。
const daily = computed(() => {
  const sums = new Map()
  for (const row of props.rows) {
    const date = String(row.date || '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    sums.set(date, (sums.get(date) || 0) + (Number(row.cost) || 0))
  }
  const dates = [...sums.keys()].sort()
  return {
    dates,
    data: dates.map((date) => [date, Number((sums.get(date) || 0).toFixed(6))]),
    max: Math.max(1, ...dates.map((date) => sums.get(date) || 0)),
  }
})

function option() {
  const skin = colors.value
  const night = dark.value
  const text = skin['on-surface-variant']
  const line = night ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'
  const { dates, data, max } = daily.value
  const range = dates.length ? [dates[0], dates[dates.length - 1]] : undefined
  return {
    animationDuration: 240,
    notMerge: true,
    textStyle: { fontFamily: FONT },
    title: props.title
      ? {
          text: props.title,
          left: 12,
          top: 6,
          textStyle: { color: skin['on-surface'], fontSize: 13, fontWeight: 600, fontFamily: FONT },
        }
      : undefined,
    tooltip: {
      trigger: 'item',
      backgroundColor: skin.surface,
      borderColor: line,
      textStyle: { color: skin['on-surface'], fontFamily: FONT },
      formatter: (item) => {
        const [date, value] = item.value || []
        return `${date}<br/>${item.marker}¥${fmtMoney(value)}`
      },
    },
    visualMap: {
      min: 0,
      max,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      itemWidth: 10,
      itemHeight: 70,
      textStyle: { color: text, fontSize: 11, fontFamily: FONT },
      inRange: {
        color: [fade(skin.primary, 0.08), fade(skin.primary, 0.4), skin.primary],
      },
    },
    calendar: {
      range,
      top: 52,
      left: 40,
      right: 16,
      bottom: 40,
      cellSize: ['auto', 14],
      splitLine: { lineStyle: { color: line } },
      itemStyle: { color: 'transparent', borderColor: line, borderWidth: 1 },
      dayLabel: { color: text, fontSize: 11, fontFamily: FONT, firstDay: 1 },
      monthLabel: { color: text, fontSize: 11, fontFamily: FONT },
      yearLabel: { show: false },
    },
    series: [
      {
        type: 'heatmap',
        coordinateSystem: 'calendar',
        data,
        itemStyle: { borderRadius: 2 },
      },
    ],
  }
}

function draw() {
  if (!chart) return
  chart.setOption(option(), true)
}

function fit() {
  chart?.resize()
}

onMounted(() => {
  chart = echarts.init(box.value)
  draw()
  if (window.ResizeObserver) {
    watcher = new ResizeObserver(fit)
    watcher.observe(box.value)
  }
  window.addEventListener('resize', fit)
})

watch(() => [props.rows, theme.current.value], draw, { deep: true })

onBeforeUnmount(() => {
  watcher?.disconnect()
  window.removeEventListener('resize', fit)
  chart?.dispose()
  chart = null
})
</script>

<template>
  <div ref="box" class="calendar" :style="{ height: `${height}px` }"></div>
</template>
