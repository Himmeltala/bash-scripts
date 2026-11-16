<template>
  <MetricSparkline
    name="内存"
    title="内存占用"
    color="mem"
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
  const mem = props.metrics && props.metrics.mem
  return mem && typeof mem.percent === 'number' ? mem.percent : null
})
const time = computed(() => (props.metrics ? props.metrics.time : null))
</script>
