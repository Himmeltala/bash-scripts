// 性能指标组件：默认组合三件套，业务也可以只取其中某个 widget 自己摆。
// 这条入口依赖 echarts，由使用方提供，所以单独出一个子入口，不进主入口。
export { default } from './Metrics.vue'
export { default as Metrics } from './Metrics.vue'
export { default as MetricSparkline } from './widgets/MetricSparkline.vue'
export { default as MetricCpu } from './widgets/MetricCpu.vue'
export { default as MetricMemory } from './widgets/MetricMemory.vue'
export { default as MetricDisk } from './widgets/MetricDisk.vue'
