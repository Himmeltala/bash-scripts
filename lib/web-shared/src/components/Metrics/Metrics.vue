<template>
  <div class="metrics">
    <MetricCpu :dark="dark" :metrics="metrics" />
    <MetricMemory :dark="dark" :metrics="metrics" />
    <MetricDisk :dark="dark" :metrics="metrics" />
  </div>
</template>

<script setup>
import MetricCpu from './widgets/MetricCpu.vue'
import MetricDisk from './widgets/MetricDisk.vue'
import MetricMemory from './widgets/MetricMemory.vue'

defineProps({
  dark: { type: Boolean, default: false },
  metrics: { type: Object, default: null },
})
</script>

<style scoped src="./Metrics.css"></style>
