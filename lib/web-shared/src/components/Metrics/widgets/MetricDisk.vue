<template>
  <MetricSparkline
    name="磁盘"
    :title="title"
    color="disk"
    :dark="dark"
    :value="value"
    :time="time"
  />
</template>

<script setup>
import { computed } from 'vue'
import MetricSparkline from './MetricSparkline.vue'

const props = defineProps({
  dark: { type: Boolean, default: false },
  metrics: { type: Object, default: null },
})

const value = computed(() => {
  const disk = props.metrics && props.metrics.disk
  return disk && typeof disk.percent === 'number' ? disk.percent : null
})
const time = computed(() => (props.metrics ? props.metrics.time : null))
const title = computed(() => {
  const disk = props.metrics && props.metrics.disk
  return disk && disk.mount ? `磁盘占用（${disk.mount}）` : '磁盘占用'
})
</script>
