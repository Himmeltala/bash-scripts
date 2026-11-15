<template>
  <MetricSparkline
    name="上传"
    :title="title"
    color="up"
    unit="speed"
    auto-max
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

const net = computed(() => (props.metrics && props.metrics.net) || null)
const value = computed(() =>
  net.value && typeof net.value.up === 'number' ? net.value.up : null,
)
const time = computed(() => (props.metrics ? props.metrics.time : null))
const title = computed(() =>
  net.value && net.value.iface ? `上传速度（${net.value.iface}）` : '上传速度',
)
</script>
