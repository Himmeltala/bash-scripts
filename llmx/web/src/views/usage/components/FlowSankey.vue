<script setup>
import { computed, ref, watch } from 'vue'
import * as echarts from 'echarts/core'
import { SankeyChart } from 'echarts/charts'
import { TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useTheme } from 'vuetify'
import { SOURCE_LIST, fmtMoney } from '../composables/format'
import { CHART_FONT, chartTitle } from '../composables/chartUtils'
import { useChart } from '../composables/useChart'

echarts.use([SankeyChart, TooltipComponent, CanvasRenderer])

const props = defineProps({
  rows: { type: Array, default: () => [] },
  // 第二层的目标字段：project 或 api。
  targetKey: { type: String, default: 'project' },
  targetLabel: { type: String, default: '项目' },
  title: { type: String, default: '费用流向：来源、模型与目标' },
  height: { type: Number, default: 320 },
})

const box = ref(null)

const theme = useTheme()
const colors = computed(() => theme.current.value.colors)

// 只留费用最高的 8 个模型与 8 个目标，其余并成「其他」，免得桑基图被细线占满。
const TOP = 8

const TOPKEEP = (map) =>
  new Set(
    [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP)
      .map(([name]) => name)
  )

const flow = computed(() => {
  const modelCost = new Map()
  const targetCost = new Map()
  const add = (map, name, value) => map.set(name, (map.get(name) || 0) + value)
  for (const row of props.rows) {
    const value = Number(row.cost) || 0
    if (value <= 0) continue
    add(modelCost, row.model || '未记录', value)
    add(targetCost, row[props.targetKey] || '未记录', value)
  }
  const models = TOPKEEP(modelCost)
  const targets = TOPKEEP(targetCost)
  const sourceCost = new Map()
  const sourceToModel = new Map()
  const modelToTarget = new Map()
  for (const row of props.rows) {
    const value = Number(row.cost) || 0
    if (value <= 0) continue
    const source = row.source || '未知'
    const model = models.has(row.model || '未记录') ? row.model || '未记录' : '其他模型'
    const target = targets.has(row[props.targetKey] || '未记录')
      ? row[props.targetKey] || '未记录'
      : `其他${props.targetLabel}`
    add(sourceCost, source, value)
    const sm = `${source}\u0000${model}`
    sourceToModel.set(sm, (sourceToModel.get(sm) || 0) + value)
    const mt = `${model}\u0000${target}`
    modelToTarget.set(mt, (modelToTarget.get(mt) || 0) + value)
  }
  const links = []
  for (const [key, value] of sourceToModel) {
    const [source, model] = key.split('\u0000')
    if (value <= 0) continue
    links.push({ source: `s:${source}`, target: `m:${model}`, value: Number(value.toFixed(6)) })
  }
  for (const [key, value] of modelToTarget) {
    const [model, target] = key.split('\u0000')
    if (value <= 0) continue
    links.push({ source: `m:${model}`, target: `t:${target}`, value: Number(value.toFixed(6)) })
  }
  // 只给真正连上的节点建块，避免出现没有任何流向的「其他」空节点。
  const used = new Set()
  for (const link of links) {
    used.add(link.source)
    used.add(link.target)
  }
  const nodes = new Map()
  const addNode = (key, label, color) => {
    if (used.has(key) && !nodes.has(key)) {
      // 节点标签用 display 存，label 留给 ECharts 的标签样式配置；
      // 右侧放不下太长的项目名或接口地址，先截短，完整名字留在悬停提示里。
      const shown = label.length > 16 ? `${label.slice(0, 15)}…` : label
      nodes.set(key, { name: key, display: shown, full: label, itemStyle: { color } })
    }
  }
  const sourceColor = (name) => (SOURCE_LIST.find((item) => item.key === name) || {}).color
  for (const name of sourceCost.keys()) {
    addNode(
      `s:${name}`,
      (SOURCE_LIST.find((item) => item.key === name) || {}).name || name,
      sourceColor(name)
    )
  }
  for (const name of models) addNode(`m:${name}`, name, colors.value.primary)
  for (const name of targets) addNode(`t:${name}`, name, colors.value['on-surface-variant'])
  addNode('m:其他模型', '其他模型', colors.value['surface-variant'])
  addNode(`t:其他${props.targetLabel}`, `其他${props.targetLabel}`, colors.value['surface-variant'])
  return { nodes: [...nodes.values()], links }
})

function option() {
  const skin = colors.value
  const { nodes, links } = flow.value
  return {
    animationDuration: 240,
    textStyle: { fontFamily: CHART_FONT },
    title: chartTitle(props.title, skin),
    tooltip: {
      trigger: 'item',
      backgroundColor: skin.surface,
      borderColor: skin['on-surface-variant'],
      textStyle: { color: skin['on-surface'], fontFamily: CHART_FONT },
      formatter: (item) => {
        if (item.dataType === 'edge') {
          const fromNode = nodes.find((node) => node.name === item.data.source) || {}
          const toNode = nodes.find((node) => node.name === item.data.target) || {}
          return `来源：${fromNode.full || fromNode.display}<br/>去向：${toNode.full || toNode.display}<br/>费用：¥${fmtMoney(item.data.value)}`
        }
        return `${item.data.full || item.data.display}<br/>¥${fmtMoney(item.value ?? item.data.value)}`
      },
    },
    series: [
      {
        type: 'sankey',
        left: 12,
        right: 100,
        top: 44,
        bottom: 12,
        nodeWidth: 12,
        nodeGap: 10,
        draggable: false,
        emphasis: { focus: 'adjacency' },
        label: {
          color: skin['on-surface'],
          fontSize: 11,
          fontFamily: CHART_FONT,
          width: 96,
          overflow: 'truncate',
          ellipsis: '…',
          formatter: (item) => item.data.display,
        },
        lineStyle: { color: 'gradient', opacity: 0.32, curveness: 0.5 },
        data: nodes,
        links,
      },
    ],
  }
}

const { render } = useChart(box, (chart) => chart.setOption(option(), true))

watch(() => [props.rows, props.targetKey, theme.current.value], render, { deep: true })
</script>

<template>
  <div ref="box" class="sankey" :style="{ height: `${height}px` }"></div>
</template>
