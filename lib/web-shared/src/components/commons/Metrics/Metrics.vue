<template>
  <div class="metrics">
    <MetricCpu v-if="show('cpu')" :dark="dark" :metrics="metrics" />
    <MetricMemory v-if="show('memory')" :dark="dark" :metrics="metrics" />
    <MetricDisk v-if="show('disk')" :dark="dark" :metrics="metrics" />
    <MetricDownload v-if="show('download')" :dark="dark" :metrics="metrics" />
    <MetricUpload v-if="show('upload')" :dark="dark" :metrics="metrics" />
  </div>
</template>

<script setup>
import MetricCpu from './widgets/MetricCpu.vue'
import MetricDisk from './widgets/MetricDisk.vue'
import MetricDownload from './widgets/MetricDownload.vue'
import MetricMemory from './widgets/MetricMemory.vue'
import MetricUpload from './widgets/MetricUpload.vue'

const props = defineProps({
  dark: { type: Boolean, default: false },
  metrics: { type: Object, default: null },
  // 顶栏设置传进来的开关；不传或某一项没写就当显示，其他页面照旧全显示。
  visible: { type: Object, default: null },
})

function show(key) {
  if (!props.visible) return true
  return props.visible[key] !== false
}
</script>

<style scoped src="./Metrics.css"></style>
