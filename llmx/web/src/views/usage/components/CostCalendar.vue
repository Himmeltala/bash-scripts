<script setup>
import { computed, ref, watch } from 'vue'
import * as echarts from 'echarts/core'
import { HeatmapChart } from 'echarts/charts'
import { CalendarComponent, TooltipComponent, VisualMapComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useTheme } from 'vuetify'
import { fmtMoney } from '../lib/format'
import { CHART_FONT, chartTitle, fadeColor } from '../lib/chartUtils'
import { useChart } from '../composables/useChart'

echarts.use([HeatmapChart, CalendarComponent, TooltipComponent, VisualMapComponent, CanvasRenderer])

const props = defineProps({
  // 按天报表的行：date 是 YYYY-MM-DD，cost 是当天费用。
  rows: { type: Array, default: () => [] },
  title: { type: String, default: '每日费用日历（元）' },
  height: { type: Number, default: 240 },
})

const box = ref(null)

const theme = useTheme()
const colors = computed(() => theme.current.value.colors)
const dark = computed(() => theme.current.value.dark)

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
    textStyle: { fontFamily: CHART_FONT },
    title: chartTitle(props.title, skin),
    tooltip: {
      trigger: 'item',
      backgroundColor: skin.surface,
      borderColor: line,
      textStyle: { color: skin['on-surface'], fontFamily: CHART_FONT },
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
      textStyle: { color: text, fontSize: 11, fontFamily: CHART_FONT },
      inRange: {
        color: [fadeColor(skin.primary, 0.08), fadeColor(skin.primary, 0.4), skin.primary],
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
      dayLabel: { color: text, fontSize: 11, fontFamily: CHART_FONT, firstDay: 1 },
      monthLabel: { color: text, fontSize: 11, fontFamily: CHART_FONT },
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

const { render } = useChart(box, (chart) => chart.setOption(option(), true))

watch(() => [props.rows, theme.current.value], render, { deep: true })
</script>

<template>
  <div ref="box" class="calendar" :style="{ height: `${height}px` }"></div>
</template>
