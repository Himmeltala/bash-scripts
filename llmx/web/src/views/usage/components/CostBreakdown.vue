<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts/core'
import { PieChart } from 'echarts/charts'
import { LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useTheme } from 'vuetify'
import { data } from '../composables/useUsage'
import { fmtMoney } from '../lib/format'

echarts.use([PieChart, LegendComponent, TooltipComponent, CanvasRenderer])

// 费用按 token 类别拆开：输入未命中、缓存读、缓存写、输出。
const PARTS = [
  { key: 'cost_input', name: '输入未命中', color: '#3b82f6' },
  { key: 'cost_cache_read', name: '缓存读', color: '#22c55e' },
  { key: 'cost_cache_write', name: '缓存写', color: '#f59e0b' },
  { key: 'cost_output', name: '输出', color: '#ef4444' },
]
const FONT = 'Roboto, sans-serif'

// 只画有金额的类别，零值会让图例多出空项。
const rows = computed(() => {
  const totals = data.value?.totals || {}
  return PARTS.map((part) => ({ ...part, value: Number(totals[part.key]) || 0 })).filter(
    (part) => part.value > 0,
  )
})

const box = ref(null)
let chart = null
let watcher = null

const theme = useTheme()
const skin = computed(() => theme.current.value.colors)

function option() {
  const colors = skin.value
  const text = colors['on-surface-variant']
  const line = theme.current.value.dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'
  return {
    animationDuration: 240,
    textStyle: { fontFamily: FONT },
    tooltip: {
      trigger: 'item',
      backgroundColor: colors.surface,
      borderColor: line,
      textStyle: { color: colors['on-surface'], fontFamily: FONT },
      formatter: (item) =>
        `${item.marker}${item.name}<br/>¥${fmtMoney(item.value)}（${item.percent}%）`,
    },
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'middle',
      icon: 'circle',
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: text, fontSize: 12, fontFamily: FONT },
      // 图例只负责说明颜色，点它不让扇区消失。
      selectedMode: false,
      formatter: (name) => {
        const row = rows.value.find((item) => item.name === name)
        return row ? `${name}  ¥${fmtMoney(row.value)}` : name
      },
    },
    series: [
      {
        type: 'pie',
        radius: '66%',
        // 左边留给饼图，右边留给图例。
        center: ['34%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: colors.surface, borderWidth: 2 },
        label: { color: text, fontSize: 11, fontFamily: FONT, formatter: '{d}%' },
        labelLine: { lineStyle: { color: line } },
        data: rows.value.map((row) => ({
          name: row.name,
          value: row.value,
          itemStyle: { color: row.color },
        })),
      },
    ],
  }
}

function draw() {
  if (chart) chart.setOption(option(), true)
}

function fit() {
  chart?.resize()
}

function start() {
  if (chart || !box.value) return
  chart = echarts.init(box.value)
  draw()
  // 弹窗拖动改变大小时跟着重排。
  if (window.ResizeObserver) {
    watcher = new ResizeObserver(fit)
    watcher.observe(box.value)
  }
  window.addEventListener('resize', fit)
}

function stop() {
  watcher?.disconnect()
  watcher = null
  window.removeEventListener('resize', fit)
  chart?.dispose()
  chart = null
}

onMounted(start)
watch(rows, (list) => {
  if (!list.length) {
    stop()
    return
  }
  // 数据从无到有时盒子才出现，等这一帧挂上再初始化，之后再按新数据重画。
  nextTick(() => {
    start()
    draw()
  })
})
watch(theme.current, draw, { deep: true })

onBeforeUnmount(stop)
</script>

<template>
  <div v-if="rows.length" ref="box" class="chart"></div>
  <p v-else class="empty">当前范围没有可计价的费用。</p>
</template>

<style scoped>
.chart {
  height: 240px;
}

.empty {
  margin: 0;
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.85rem;
}
</style>
