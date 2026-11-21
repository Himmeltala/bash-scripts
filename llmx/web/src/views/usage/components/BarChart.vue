<script setup>
import { computed, ref, watch } from 'vue'
import * as echarts from 'echarts/core'
import { BarChart, HeatmapChart, LineChart, PieChart } from 'echarts/charts'
import { LegendComponent, GridComponent, TooltipComponent, VisualMapComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useTheme } from 'vuetify'
import { fmtTokens } from '../composables/format'
import { CHART_FONT, fadeColor } from '../composables/chartUtils'
import { useChart } from '../composables/useChart'

const PEAK = '高峰'
const OFF = '空闲'

echarts.use([
  BarChart,
  LineChart,
  HeatmapChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  VisualMapComponent,
  CanvasRenderer,
])

const props = defineProps({
  // 单系列：items: [{ label, value, peak, tokens }]，柱子按档位染成高峰或空闲色。
  items: { type: Array, default: () => [] },
  // 多系列：categories 是横轴刻度，series 是 [{ name, color, data }]，一个名字一组柱子并排。
  categories: { type: Array, default: () => [] },
  series: { type: Array, default: () => [] },
  // 标题与图例写在图内，跟命令行报表的写法一致。
  title: { type: String, default: '' },
  // 图例说明柱子颜色的含义，单系列是「高峰 / 空闲」，多系列是各组自己的名字。
  legend: { type: Boolean, default: false },
  // 图的像素高度，卡片的宽度由栅格给，高度得自己定，否则 canvas 没有可用尺寸。
  height: { type: Number, default: 260 },
  // bar 柱状，stacked 堆叠，line 平滑折线加渐隐面积，heatmap 色块矩阵，donut 环形占比。
  mode: { type: String, default: 'bar' },
  // 金额小数位，默认与全站一致取 4 位。
  digits: { type: Number, default: 4 },
})

function money(value) {
  return (Number(value) || 0).toLocaleString('zh-CN', {
    minimumFractionDigits: props.digits,
    maximumFractionDigits: props.digits,
  })
}

const box = ref(null)

// 颜色全部取自 Vuetify 主题，页面切换深浅色时整张图跟着重画。
const theme = useTheme()
const colors = computed(() => theme.current.value.colors)
const dark = computed(() => theme.current.value.dark)

const multi = computed(() => props.series.length > 0)

// 横轴刻度：多系列时用给好的类别，单系列用每根柱子自己的短名。
const labels = computed(() =>
  multi.value ? props.categories : props.items.map((item) => item.short || item.label),
)

function lineOf(item) {
  return {
    type: 'line',
    name: item.name,
    smooth: true,
    showSymbol: false,
    symbolSize: 0,
    // 某一时段没有这份数据时直接连过去，别把线断在半空。
    connectNulls: true,
    data: item.data,
    lineStyle: { width: 2, color: item.color },
    itemStyle: { color: item.color },
    areaStyle: {
      color: {
        type: 'linear',
        x: 0,
        y: 0,
        x2: 0,
        y2: 1,
        colorStops: [
          { offset: 0, color: fadeColor(item.color, 0.28) },
          { offset: 1, color: fadeColor(item.color, 0) },
        ],
      },
    },
    emphasis: { focus: 'series' },
  }
}

// 各系列合计，环形图按来源（或高峰、空闲）切分。
function totalOf(item) {
  return item.data.reduce((sum, value) => sum + (Number(value) || 0), 0)
}

function donutSeries(skin) {
  const data = multi.value
    ? props.series.map((item) => ({
        name: item.name,
        value: totalOf(item),
        itemStyle: { color: item.color },
      }))
    : [
        {
          name: PEAK,
          value: props.items.reduce((sum, item) => sum + (item.peak ? Number(item.value) || 0 : 0), 0),
          itemStyle: { color: skin.peak },
        },
        {
          name: OFF,
          value: props.items.reduce((sum, item) => sum + (item.peak ? 0 : Number(item.value) || 0), 0),
          itemStyle: { color: skin.off },
        },
      ]
  return [
    {
      type: 'pie',
      radius: ['42%', '68%'],
      center: ['50%', '56%'],
      avoidLabelOverlap: true,
      itemStyle: { borderColor: skin.surface, borderWidth: 2 },
      label: { show: false },
      emphasis: { scale: true, scaleSize: 4 },
      data: data.filter((item) => item.value > 0),
    },
  ]
}

function seriesOf(skin) {
  const stacked = props.mode === 'stacked'
  if (props.mode === 'line') {
    if (multi.value) return props.series.map(lineOf)
    // 单系列仍按高峰、空闲分两条线，跟柱状图的图例一致；各自只在属于自己的小时上有值。
    return [
      lineOf({
        name: PEAK,
        color: skin.peak,
        data: props.items.map((item) => (item.peak ? item.value : null)),
      }),
      lineOf({
        name: OFF,
        color: skin.off,
        data: props.items.map((item) => (item.peak ? null : item.value)),
      }),
    ]
  }
  if (multi.value) {
    return props.series.map((item) => ({
      type: 'bar',
      name: item.name,
      barMaxWidth: 28,
      stack: stacked ? 'total' : undefined,
      data: item.data,
      itemStyle: { color: item.color, borderRadius: stacked ? 0 : [2, 2, 0, 0] },
    }))
  }
  // 每根柱子的档位不一定相同，所以高峰、空闲各占一条系列，同一时刻只有一条有值。
  return [
    {
      type: 'bar',
      name: PEAK,
      barMaxWidth: 28,
      barGap: '-100%',
      stack: stacked ? 'total' : undefined,
      data: props.items.map((item) => (item.peak ? item.value : null)),
      itemStyle: { color: skin.peak, borderRadius: stacked ? 0 : [2, 2, 0, 0] },
    },
    {
      type: 'bar',
      name: OFF,
      barMaxWidth: 28,
      barGap: '-100%',
      stack: stacked ? 'total' : undefined,
      data: props.items.map((item) => (item.peak ? null : item.value)),
      itemStyle: { color: skin.off, borderRadius: stacked ? 0 : [2, 2, 0, 0] },
    },
  ]
}

function heatRows() {
  if (multi.value) return props.series.map((item) => ({ name: item.name, data: item.data }))
  return [{ name: '费用', data: props.items.map((item) => item.value) }]
}

function heatCells(rows) {
  const cells = []
  rows.forEach((row, y) => {
    row.data.forEach((value, x) => {
      if (value == null || !Number.isFinite(Number(value))) return
      cells.push([x, y, Number(value)])
    })
  })
  return cells
}

function option() {
  const skin = colors.value
  const night = dark.value
  const text = skin['on-surface-variant']
  const line = night ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'
  const isHeat = props.mode === 'heatmap'
  const isLine = props.mode === 'line'
  const isDonut = props.mode === 'donut'
  const rows = isHeat ? heatRows() : []
  const cells = isHeat ? heatCells(rows) : []
  const maxValue = cells.reduce((max, cell) => Math.max(max, cell[2]), 0) || 1
  const series = isHeat
    ? [
        {
          type: 'heatmap',
          name: '费用',
          data: cells,
          itemStyle: { borderColor: skin.surface, borderWidth: 1 },
          emphasis: { itemStyle: { shadowBlur: 6, shadowColor: 'rgba(0,0,0,0.3)' } },
        },
      ]
    : isDonut
      ? donutSeries(skin)
      : seriesOf(skin)
  const legendNames = isDonut
    ? (series[0] && series[0].data ? series[0].data.map((item) => item.name) : [])
    : series.map((item) => item.name)
  return {
    animationDuration: 240,
    // 两个并排的图各自管自己的残影，不清掉旧选项的话换数据后图例会重复叠上去。
    notMerge: true,
    textStyle: { fontFamily: CHART_FONT },
    grid: isDonut
      ? undefined
      : { left: 8, right: 8, top: 44, bottom: isHeat ? 48 : 22, containLabel: true },
    tooltip: {
      // 折线不画数据点，按 item 悬停没有命中面积；改成按横轴取一整列。
      trigger: isLine ? 'axis' : 'item',
      backgroundColor: skin.surface,
      borderColor: line,
      textStyle: { color: skin['on-surface'], fontFamily: CHART_FONT },
      formatter: (payload) => {
        const items = Array.isArray(payload) ? payload : [payload]
        const first = items[0] || {}
        if (isDonut) {
          const share = first.percent == null ? '' : `（${first.percent}%）`
          return `${first.name}<br/>${first.marker}¥${money(first.value)}${share}`
        }
        if (isHeat) {
          const [x, y, value] = first.value || []
          const name = rows[y] ? rows[y].name : ''
          return `${labels.value[x] ?? ''}<br/>${first.marker}${name} ¥${money(value)}`
        }
        const index = first.dataIndex
        if (multi.value) {
          const label = labels.value[index] ?? ''
          const lines = items
            .filter((entry) => entry.value != null)
            .map((entry) => `${entry.marker}${entry.seriesName} ¥${money(entry.value)}`)
          return `${label}<br/>${lines.join('<br/>')}`
        }
        const picked = props.items[index]
        if (!picked) return ''
        const tokens = picked.tokens == null ? '' : `<br/>${fmtTokens(picked.tokens)} token`
        return `${picked.label}<br/>¥${money(picked.value)}${tokens}`
      },
    },
    visualMap: isHeat
      ? {
          min: 0,
          max: maxValue,
          calculable: true,
          orient: 'horizontal',
          right: 12,
          bottom: 0,
          itemWidth: 10,
          itemHeight: 70,
          textStyle: { color: text, fontSize: 11, fontFamily: CHART_FONT },
          inRange: {
            color: [fadeColor(skin.primary, 0.08), fadeColor(skin.primary, 0.4), skin.primary],
          },
        }
      : undefined,
    title: props.title
      ? {
          text: props.title,
          left: 12,
          top: 6,
          textStyle: { color: skin['on-surface'], fontSize: 13, fontWeight: 600, fontFamily: CHART_FONT },
        }
      : undefined,
    legend:
      props.legend && !isHeat
        ? {
            data: legendNames,
            right: 12,
            top: 8,
            icon: 'roundRect',
            itemWidth: 10,
            itemHeight: 10,
            textStyle: { color: text, fontSize: 11, fontFamily: CHART_FONT },
            // 图例只管说明颜色，点它不让柱子消失。
            selectedMode: false,
          }
        : undefined,
    xAxis: isDonut
      ? undefined
      : {
          type: 'category',
          // 标注用短名，完整名字放到悬停提示里，免得拥挤时刻度全被跳过。
          data: labels.value,
          axisLine: { lineStyle: { color: line } },
          axisTick: { show: false },
          axisLabel: {
            color: text,
            fontSize: 11,
            fontFamily: CHART_FONT,
            interval: 'auto',
            hideOverlap: true,
          },
        },
    yAxis: isDonut
      ? undefined
      : isHeat
        ? {
            type: 'category',
            data: rows.map((row) => row.name),
            axisLine: { lineStyle: { color: line } },
            axisTick: { show: false },
            axisLabel: { color: text, fontSize: 11, fontFamily: CHART_FONT },
            splitLine: { show: false },
          }
        : {
            type: 'value',
            axisLabel: {
              color: text,
              fontSize: 11,
              fontFamily: CHART_FONT,
              formatter: (value) => `¥${money(value)}`,
            },
            splitLine: { lineStyle: { color: line } },
          },
    series,
  }
}

const { render } = useChart(box, (chart) => chart.setOption(option(), true))

watch(() => [props.items, props.categories, props.series, props.mode], render, { deep: true })
watch(theme.current, render, { deep: true })
</script>

<template>
  <div ref="box" class="chart" :style="{ height: `${height}px` }"></div>
</template>
