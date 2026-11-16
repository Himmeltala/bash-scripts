<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { LegendComponent, GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useTheme } from 'vuetify'
import { fmtMoney, fmtTokens } from '../composables/format'

const PEAK = '高峰'
const OFF = '空闲'
const FONT = 'Roboto, sans-serif'

echarts.use([BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

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
})

const box = ref(null)
let chart = null
let watcher = null

// 颜色全部取自 Vuetify 主题，页面切换深浅色时整张图跟着重画。
const theme = useTheme()
const colors = computed(() => theme.current.value.colors)
const dark = computed(() => theme.current.value.dark)

const multi = computed(() => props.series.length > 0)

// 横轴刻度：多系列时用给好的类别，单系列用每根柱子自己的短名。
const labels = computed(() =>
  multi.value ? props.categories : props.items.map((item) => item.short || item.label),
)

function seriesOf(skin) {
  if (multi.value) {
    return props.series.map((item) => ({
      type: 'bar',
      name: item.name,
      barMaxWidth: 28,
      data: item.data,
      itemStyle: { color: item.color, borderRadius: [2, 2, 0, 0] },
    }))
  }
  // 每根柱子的档位不一定相同，所以高峰、空闲各占一条系列，同一时刻只有一条有值。
  return [
    {
      type: 'bar',
      name: PEAK,
      barMaxWidth: 28,
      barGap: '-100%',
      data: props.items.map((item) => (item.peak ? item.value : null)),
      itemStyle: { color: skin.peak, borderRadius: [2, 2, 0, 0] },
    },
    {
      type: 'bar',
      name: OFF,
      barMaxWidth: 28,
      barGap: '-100%',
      data: props.items.map((item) => (item.peak ? null : item.value)),
      itemStyle: { color: skin.off, borderRadius: [2, 2, 0, 0] },
    },
  ]
}

function option() {
  const skin = colors.value
  const night = dark.value
  const text = skin['on-surface-variant']
  const line = night ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'
  const series = seriesOf(skin)
  return {
    animationDuration: 240,
    // 两个并排的图各自管自己的残影，不清掉旧选项的话换数据后图例会重复叠上去。
    notMerge: true,
    textStyle: { fontFamily: FONT },
    grid: { left: 8, right: 8, top: 44, bottom: 22, containLabel: true },
    tooltip: {
      trigger: 'item',
      backgroundColor: skin.surface,
      borderColor: line,
      textStyle: { color: skin['on-surface'], fontFamily: FONT },
      formatter: (item) => {
        const label = labels.value[item.dataIndex] ?? ''
        if (multi.value) {
          return `${label}<br/>${item.marker}${item.seriesName} ¥${fmtMoney(item.value)}`
        }
        const picked = props.items[item.dataIndex]
        if (!picked) return ''
        const tokens = picked.tokens == null ? '' : `<br/>${fmtTokens(picked.tokens)} token`
        return `${picked.label}<br/>¥${fmtMoney(picked.value)}${tokens}`
      },
    },
    title: props.title
      ? {
          text: props.title,
          left: 12,
          top: 6,
          textStyle: { color: skin['on-surface'], fontSize: 13, fontWeight: 600, fontFamily: FONT },
        }
      : undefined,
    legend: props.legend
      ? {
          data: series.map((item) => item.name),
          right: 12,
          top: 8,
          icon: 'roundRect',
          itemWidth: 10,
          itemHeight: 10,
          textStyle: { color: text, fontSize: 11, fontFamily: FONT },
          // 图例只管说明颜色，点它不让柱子消失。
          selectedMode: false,
        }
      : undefined,
    xAxis: {
      type: 'category',
      // 标注用短名，完整名字放到悬停提示里，免得拥挤时刻度全被跳过。
      data: labels.value,
      axisLine: { lineStyle: { color: line } },
      axisTick: { show: false },
      axisLabel: {
        color: text,
        fontSize: 11,
        fontFamily: FONT,
        interval: 'auto',
        hideOverlap: true,
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: text,
        fontSize: 11,
        fontFamily: FONT,
        formatter: (value) => `¥${value}`,
      },
      splitLine: { lineStyle: { color: line } },
    },
    series,
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
  // 卡片宽度只有布局完成才知道，用 ResizeObserver 跟着卡片走，比监听窗口变化准。
  if (window.ResizeObserver) {
    watcher = new ResizeObserver(fit)
    watcher.observe(box.value)
  }
  window.addEventListener('resize', fit)
})

watch(() => [props.items, props.categories, props.series], draw, { deep: true })
watch(theme.current, draw, { deep: true })

onBeforeUnmount(() => {
  watcher?.disconnect()
  window.removeEventListener('resize', fit)
  chart?.dispose()
  chart = null
})
</script>

<template>
  <div ref="box" class="chart" :style="{ height: `${height}px` }"></div>
</template>
