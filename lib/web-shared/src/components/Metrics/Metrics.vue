<template>
  <div class="metrics">
    <MetricCpu :dark="dark" :metrics="metrics" />
    <MetricMemory :dark="dark" :metrics="metrics" />
    <MetricDisk :dark="dark" :metrics="metrics" />
    <MetricDownload :dark="dark" :metrics="metrics" />
    <MetricUpload :dark="dark" :metrics="metrics" />
  </div>
</template>

<script setup>
import MetricCpu from './widgets/MetricCpu.vue'
import MetricDisk from './widgets/MetricDisk.vue'
import MetricDownload from './widgets/MetricDownload.vue'
import MetricMemory from './widgets/MetricMemory.vue'
import MetricUpload from './widgets/MetricUpload.vue'

defineProps({
  dark: { type: Boolean, default: false },
  metrics: { type: Object, default: null },
})
</script>

<style scoped src="./Metrics.css"></style>
