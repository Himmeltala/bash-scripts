<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { GridComponent, MarkAreaComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { fmtMoney, fmtTokens } from '../composables/format'

echarts.use([BarChart, GridComponent, TooltipComponent, MarkAreaComponent, CanvasRenderer])

const props = defineProps({
  // items: [{ label, value, peak, tokens }]，按传入顺序画柱子。
  items: { type: Array, default: () => [] },
  // 高峰号段：用来画背景色带，也用来给柱子上色。
  windows: { type: Array, default: () => [] },
  // 标题与图例写在图内左上角，跟命令行报表的写法一致。
  title: { type: String, default: '' },
  legend: { type: String, default: '' },
})

const box = ref(null)
let chart = null

const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches

function option() {
  const text = dark ? '#9ca3af' : '#6b7280'
  const line = dark ? '#2c3138' : '#e3e6ea'
  const peakColor = dark ? '#fbbf24' : '#f59e0b'
  const offColor = dark ? '#60a5fa' : '#2563eb'
  const max = Math.max(...props.items.map((item) => item.value), 0.000001)
  return {
    animationDuration: 240,
    // 两个并排的图各自管自己的残影，不清掉旧选项的话换数据后图例会重复叠上去。
    notMerge: true,
    grid: { left: 8, right: 8, top: 44, bottom: 22, containLabel: true },
    tooltip: {
      trigger: 'item',
      backgroundColor: dark ? '#1c1f24' : '#ffffff',
      borderColor: line,
      textStyle: { color: dark ? '#e5e7eb' : '#1d2129' },
      formatter: (item) => {
        const picked = props.items[item.dataIndex]
        if (!picked) return ''
        const tokens = picked.tokens == null ? '' : `<br/>${fmtTokens(picked.tokens)} token`
        return `${picked.label}<br/>¥${fmtMoney(picked.value)}${tokens}`
      },
    },
    title: props.title
      ? { text: props.title, left: 12, top: 6, textStyle: { color: dark ? '#e5e7eb' : '#1d2129', fontSize: 13, fontWeight: 600 } }
      : undefined,
    legend: props.legend
      ? {
          data: ['高峰窗口', '空闲'],
          right: 12,
          top: 8,
          icon: 'roundRect',
          itemWidth: 10,
          itemHeight: 10,
          textStyle: { color: text, fontSize: 11 },
        }
      : undefined,
    xAxis: {
      type: 'category',
      data: props.items.map((item) => item.label),
      axisLine: { lineStyle: { color: line } },
      axisTick: { show: false },
      axisLabel: { color: text, fontSize: 11, interval: 'auto' },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: text, fontSize: 11, formatter: (value) => `¥${value}` },
      splitLine: { lineStyle: { color: line } },
    },
    series: [
      {
        type: 'bar',
        barMaxWidth: 28,
        // 两条系列共用一根柱子：柱子颜色按该点是不是高峰决定，图例只负责说明颜色。
        data: props.items.map((item) => ({
          value: item.value,
          name: item.peak ? '高峰窗口' : '空闲',
          itemStyle: { color: item.peak ? peakColor : offColor, borderRadius: [2, 2, 0, 0] },
        })),
        markArea: {
          silent: true,
          data: props.windows.map(([from, to]) => [
            { xAxis: from, itemStyle: { color: dark ? 'rgba(251,191,36,0.10)' : 'rgba(245,158,11,0.08)' } },
            { xAxis: to },
          ]),
        },

      },
    ],
  }
}

function draw() {
  if (!chart) return
  chart.setOption(option(), true)
}

onMounted(() => {
  chart = echarts.init(box.value)
  draw()
  window.addEventListener('resize', draw)
})

watch(() => props.items, draw, { deep: true })

onBeforeUnmount(() => {
  window.removeEventListener('resize', draw)
  chart?.dispose()
  chart = null
})
</script>

<template>
  <div ref="box" class="chart"></div>
</template>
