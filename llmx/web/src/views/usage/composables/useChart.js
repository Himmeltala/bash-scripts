// ECharts 实例的共同生命周期：挂载时初始化、容器尺寸变化时重绘、卸载时释放。

import { onBeforeUnmount, onMounted } from 'vue'
import * as echarts from 'echarts/core'

export function useChart(box, draw) {
  let chart = null
  let watcher = null

  function render() {
    if (!chart) return
    draw(chart)
  }

  function fit() {
    chart?.resize()
  }

  onMounted(() => {
    chart = echarts.init(box.value)
    render()
    // 卡片宽度只有布局完成才知道，用 ResizeObserver 跟着卡片走，比监听窗口变化准。
    if (window.ResizeObserver) {
      watcher = new ResizeObserver(fit)
      watcher.observe(box.value)
    }
    window.addEventListener('resize', fit)
  })

  onBeforeUnmount(() => {
    watcher?.disconnect()
    window.removeEventListener('resize', fit)
    chart?.dispose()
    chart = null
  })

  return { render }
}
