<template>
  <MetricSparkline
    name="CPU"
    title="CPU 占用"
    color="cpu"
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

const value = computed(() =>
  props.metrics && typeof props.metrics.cpu === 'number' ? props.metrics.cpu : null,
)
const time = computed(() => (props.metrics ? props.metrics.time : null))
</script>
